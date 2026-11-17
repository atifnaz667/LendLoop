# Architecture

This document explains how LendLoop is put together and why. It is the reference for structure,
security boundaries and the n8n integration contract.

## 1. System overview

```
                +---------------------+          Clerk (hosted)
  Browser  ---> |  Next.js App Router | <------  sign-in UI, session, JWT
                |  (UI only, no data) |
                +----------+----------+
                           | Convex client (WebSocket) with Clerk JWT
                           v
                +---------------------+   scheduled action, HMAC signed   +-----------+
                |       Convex        | --------------------------------> |    n8n    |
                |  queries/mutations  |   POST request events             |  (Docker) |
                |  HTTP actions       | <-------------------------------- |           |
                |  scheduler, crons   |   GET overdue loans, POST events  +-----------+
                +---------------------+   HMAC signed                         |
                           ^                                                  v
                Clerk webhook (Svix signed)                       mock notification log
                user.created / updated / deleted                  (email/Slack in production)
```

- **Next.js** renders the UI. It holds no business logic and no server secrets beyond Clerk's
  secret key, which Clerk's SDK uses for the session.
- **Convex** is the backend: data, business rules, authorization, the webhook outbox and the HTTP
  endpoints n8n calls.
- **Clerk** owns identity. Convex verifies the Clerk JWT on every call.
- **n8n** runs workflows. It never touches the database directly; it talks to Convex over signed
  HTTP only.

## 2. Layering

The project rule is routes, then controllers, then services, then models. In a
Convex app the backend lives in `convex/`, so the layers map like this:

| Layer       | Where                                                | Responsibility                                                                                    |
| ----------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Routes      | `convex/http.ts`, Convex function names              | Map a URL or API name to a handler. No logic.                                                     |
| Controllers | `convex/<domain>.ts`, `convex/integrations/*Http.ts` | Validate input (Convex `v` validators), resolve the caller, call one service, shape the response. |
| Services    | `convex/services/*.ts`                               | Business rules: permissions, state transitions, date checks, outbox.                              |
| Models      | `convex/models/*.ts`                                 | The only code that reads or writes `ctx.db`. One file per table.                                  |
| Lib         | `convex/lib/*.ts`                                    | Auth guards, errors, HMAC, date helpers, validators.                                              |

Why not Next.js API routes with controllers? Because the assignment puts data and backend logic in
Convex, and RBAC must be enforced in Convex functions. Adding a Next.js API layer in front of Convex
would duplicate authorization, add a network hop and create a second place where rules can drift.
The Next.js side still follows the same idea: `app/` routes are thin and delegate to
`features/<domain>` components and hooks, which call Convex.

The "only models touch `ctx.db`" rule is enforced by ESLint (`no-restricted-syntax` in
`eslint.config.mjs`), so it cannot quietly erode.

Example call path for "approve a request":

```
api.borrowRequests.approve        (controller: args { requestId }, requireUser)
  -> requestService.approve       (service: owner check, status check, overlap check, enqueue event)
       -> requestModel.getById / requestModel.patch / toolModel.getById
       -> outboxService.enqueue   (writes webhookDeliveries row + schedules delivery)
```

## 3. Data model

See `convex/schema.ts` for the source of truth.

| Table               | Purpose                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| `users`             | Clerk user id, display name, email, role (`admin` or `user`), trusted lender flag.                  |
| `tools`             | Listing: owner, name, category, condition, description. Soft deleted via `removedAt`.               |
| `borrowRequests`    | Request and loan in one lifecycle (see below). `ownerId` denormalized for indexed "incoming" reads. |
| `webhookDeliveries` | Transactional outbox for Convex to n8n events, with attempts and errors.                            |
| `automationEvents`  | Activity written back by n8n per loan, unique by `idempotencyKey`.                                  |

Request lifecycle (enforced by a state machine in the service layer):

```
pending --approve--> approved --markReturned--> returned
   |  \--decline--> declined
   \----cancel----> cancelled   (borrower withdraws)
```

A loan is an `approved` request. A loan is overdue when `status = approved` and
`endDate < today (UTC)`. One table keeps the history in one place and avoids keeping two records in
sync.

Tool availability is derived, not stored: a tool is "on loan" when it has an `approved` request
whose date range covers today. New requests and approvals are rejected if they overlap an existing
approved loan for the same tool.

## 4. Authentication and authorization

**Authentication (Clerk, following the official Clerk + Convex docs)**

1. `src/proxy.ts` runs `clerkMiddleware()` on all non-static routes so the session is available to
   server code. Current Clerk guidance deprecates path matching in middleware in favor of checks
   where data is accessed, so we do exactly that:
2. The `(app)` route group layout calls `auth.protect()` on the server, so signed-out users are
   redirected before any signed-in page renders.
3. `ConvexProviderWithClerk` sends the Clerk JWT to Convex. `convex/auth.config.ts` tells Convex to
   trust Clerk's issuer (`CLERK_FRONTEND_API_URL`) for the `convex` audience. Convex verifies the
   signature, issuer, audience and expiry on every call.

**User records**

- On sign-in the client calls `users.ensureCurrent`, which upserts the caller from verified JWT
  claims (never from client arguments).
- The Clerk webhook (`POST /clerk/webhook`) keeps name and email in sync and deletes the user's data
  footprint on `user.deleted`. It is verified with Svix (signature + timestamp) before parsing.

**Authorization (RBAC in Convex)**

- `lib/auth.ts` exposes `requireUser(ctx)` and `requireAdmin(ctx)`. They load the caller's `users`
  row by Clerk user id and throw `UNAUTHENTICATED` or `FORBIDDEN`.
- `services/policy.ts` holds pure permission functions such as `canEditTool(actor, tool)` and
  `canDecideRequest(actor, request)`. They are unit tested in isolation and used by every service.
- The role is stored in Convex, not taken from the client or from editable token claims. There is
  no public mutation that changes roles. The first admin is promoted with an internal mutation from
  the CLI (`npx convex run users:setRole ...`), which only someone with deployment access can run.

| Action                          | user                  | admin                              |
| ------------------------------- | --------------------- | ---------------------------------- |
| Browse tools with availability  | yes                   | yes                                |
| Create a listing                | yes                   | yes                                |
| Edit or delete a listing        | own only              | own only (admins remove, not edit) |
| Remove any listing              | no                    | yes                                |
| Request to borrow               | yes, not own tools    | yes, not own tools                 |
| Approve, decline, mark returned | requests on own tools | requests on own tools              |
| Cancel a pending request        | own requests          | own requests                       |
| View all loans                  | no                    | yes                                |
| Mark a lender as Trusted Lender | no                    | yes                                |

## 5. n8n integration

### Workflows

1. **Request notification** (webhook trigger). Convex sends `request.created`,
   `request.approved`, `request.declined`, `request.cancelled` and `request.returned`. The workflow
   verifies the signature, deduplicates by `eventId`, notifies the right person (mock log by
   default) and writes `notification_sent` back to Convex.
2. **Overdue reminders** (daily schedule). Fetches overdue loans from `GET /n8n/overdue-loans`,
   sends one reminder per borrower, and writes `reminder_sent` or `reminder_failed` back to
   `POST /n8n/automation-events`.
3. **Error handler** (Error Trigger). Both workflows point to it in their settings. It logs the
   failed workflow, node and execution URL so failures are visible and never silent.

### Signing contract

Each direction has its own shared secret, so a leak in one direction does not compromise the other.

| Direction     | Secret env var           | Signed string                               |
| ------------- | ------------------------ | ------------------------------------------- |
| Convex to n8n | `LENDLOOP_TO_N8N_SECRET` | `${timestamp}.${rawBody}`                   |
| n8n to Convex | `N8N_TO_LENDLOOP_SECRET` | `${timestamp}.${METHOD}.${path}.${rawBody}` |

Headers: `X-LendLoop-Timestamp` (Unix seconds) and `X-LendLoop-Signature: v1=<hex HMAC-SHA256>`.
Outbound requests also send `X-LendLoop-Event-Id`.

Receivers reject a request when the signature is missing or invalid (constant-time compare), or the
timestamp is more than 5 minutes away from the receiver's clock (replay window). The Convex to n8n
direction signs the raw body only because n8n's test and production webhook URLs differ; the body
already carries `eventId` and `eventType`, so the signature is bound to the event.

### Reliability

- **Outbox.** The mutation that changes a request also inserts a `webhookDeliveries` row in the same
  transaction and schedules delivery. If n8n is down, nothing is lost.
- **Retries.** The delivery action retries with exponential backoff (5 attempts). After the last
  attempt the row is marked `failed` and shown on the admin page. A cron sweeps due rows in case a
  scheduled run was missed.
- **Idempotency.** `eventId` is a stable id per state change; n8n deduplicates on it.
  Write-backs carry an `idempotencyKey` (`notification:<eventId>` or
  `reminder:<requestId>:<YYYY-MM-DD>`). Convex mutations are serializable transactions, so the
  check-then-insert on `automationEvents.by_idempotencyKey` cannot create duplicates.
- **No duplicate reminders.** The overdue endpoint excludes loans that already have a
  `reminder_sent` event for the current day, so re-running the workflow is safe.
- **n8n side.** HTTP and send nodes use Retry On Fail, and both automation workflows set the error
  workflow. A reminder that still fails takes the node's error output and records `reminder_failed`
  (key `reminder:<requestId>:<day>:failed`), so the next daily run tries again.
- **Concurrency.** Each delivery attempt first claims the row with a short lease in a mutation, so the
  scheduler and the cron sweep can never send the same event at the same time.
- **Operator visibility.** Failed deliveries (with the last error) are listed on the Admin page with a
  Retry action, and every loan shows its latest automation activity.

### Workflow source

The Code node bodies live in `n8n/code/*.js` and `scripts/build-n8n-workflows.mjs` generates the
exported JSON in `n8n/workflows/`. Unit tests execute those files with the same globals n8n provides
(`$env`, `$input`, `$getWorkflowStaticData`) and check that signatures produced by n8n verify in
Convex and vice versa.

### Data minimization in payloads

- Notification payload: event id and type, recipient first name and email, tool name, dates and
  status. No owner contact details are ever sent to a borrower and vice versa.
- Overdue endpoint: request id, borrower first name and email, tool name, end date, days overdue.
- Public tools query: name and category only.

## 6. Frontend

- `app/page.tsx` is the public page (tagline, public tool list, sign-in button).
- `app/(app)/` holds signed-in pages: `tools`, `listings`, `requests`, `incoming`, `admin`.
- `features/<domain>/` holds the components and hooks for each area. `components/ui/` holds small
  primitives (Button, Badge, Card, Select, EmptyState) built with Tailwind.
- UI state for auth uses Convex's `<Authenticated>` / `<Unauthenticated>` so the UI and backend
  agree on who is signed in.

## 7. Local topology

- Convex runs as a cloud dev deployment (free tier). Its HTTP actions are public on
  `https://<deployment>.convex.site`, so n8n in Docker reaches Convex directly.
- Convex cloud cannot reach `localhost:5678`, so the compose file has an optional `tunnel` profile
  (Cloudflare quick tunnel) that gives the n8n webhook a public HTTPS URL. Set that URL as
  `N8N_REQUEST_WEBHOOK_URL` in Convex.

## 8. Testing strategy

- `tests/unit`: pure logic (policy, state machine, date ranges, HMAC sign and verify with fixed
  vectors shared with the n8n Code nodes).
- `tests/convex`: `convex-test` runs real Convex functions against an in-memory backend with mocked
  identities to prove RBAC (for example, a user cannot approve a request on someone else's tool),
  HTTP endpoint signature checks and idempotent write-backs.
- CI (`.github/workflows/ci.yml`) runs lint, typecheck and tests on every PR.
