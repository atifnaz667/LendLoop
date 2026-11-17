# LendLoop

> Borrow what you need. Lend what you don't.

A neighborhood tool-lending board. Neighbors list tools they are willing to lend, request to borrow
from each other, and get automated notifications and overdue reminders handled by n8n.

**Stack:** Next.js 16 (App Router) + TypeScript, Clerk, Convex, n8n (self-hosted in Docker), Tailwind CSS.

## Contents

- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Architecture](#architecture)
- [Security and data minimization](#security-and-data-minimization)
- [n8n workflows](#n8n-workflows)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Running in production](#running-in-production)

## Quick start

Prerequisites: Node.js 20.9+ (22 recommended), npm, Docker Desktop, a free Clerk account and a free
Convex account.

```bash
npm install
cp .env.example .env.local
```

### 1. Clerk

1. Create an application in the [Clerk Dashboard](https://dashboard.clerk.com).
2. Copy the publishable and secret keys into `.env.local`
   (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`).
3. Open **Integrations > Convex** (Convex integration setup page), activate it, and copy the
   **Frontend API URL** (looks like `https://verb-noun-00.clerk.accounts.dev`).

4. Open **Sessions > Customize session token** and add the claims LendLoop reads (Clerk's default
   token has no email or name):

```json
{
  "email": "{{user.primary_email_address}}",
  "name": "{{user.full_name}}"
}
```

### 2. Convex

```bash
npx convex dev            # first run: log in, create the project, writes CONVEX_DEPLOYMENT and NEXT_PUBLIC_CONVEX_URL
npx convex env set CLERK_FRONTEND_API_URL https://ready-turtle-8371.clerk.accounts.dev
```

Leave `npx convex dev` running, or stop it and use `npm run dev` which runs Next.js and Convex
together.

### 3. Run the app

```bash
npm run dev               # http://localhost:3000
```

### 4. Clerk webhook (keeps profiles in sync)

1. In the Clerk Dashboard open **Webhooks > Add endpoint**.
2. Endpoint URL: `https://<your-deployment>.convex.site/clerk/webhook` (your `NEXT_PUBLIC_CONVEX_SITE_URL`
   plus `/clerk/webhook`).
3. Subscribe to `user.created`, `user.updated` and `user.deleted`.
4. Copy the endpoint's **Signing Secret** and set it on Convex:

```bash
npx convex env set CLERK_WEBHOOK_SIGNING_SECRET whsec_...
```

The app also creates your profile on first sign-in, so it works before the webhook is set up. The
webhook keeps name and email current and anonymizes the profile when a Clerk account is deleted.

### 5. Make yourself an admin

Sign in once so your profile exists, then promote it. Roles can only be changed this way (no UI or
public API can change a role):

- **Convex dashboard:** Functions > `users:setRole` > Run, with `{ "email": "you@example.com", "role": "admin" }`
- **or CLI (PowerShell):** `npx convex run users:setRole '{\"email\":\"you@example.com\",\"role\":\"admin\"}'`

If your email is not on the profile yet (the webhook fills it), pass `"clerkUserId": "user_..."` instead, copied from the Clerk Dashboard user page.

Reload the app and the **Admin** tab appears.

### 6. n8n (automation)

Full walkthrough in [n8n workflows](#n8n-workflows). Short version:

```bash
# 1. Two shared secrets, one per direction (Git Bash on Windows has openssl)
openssl rand -hex 32   # -> LENDLOOP_TO_N8N_SECRET
openssl rand -hex 32   # -> N8N_TO_LENDLOOP_SECRET
npx convex env set LENDLOOP_TO_N8N_SECRET <first>
npx convex env set N8N_TO_LENDLOOP_SECRET <second>

# 2. n8n container config
cp n8n/.env.example n8n/.env      # fill in the same two secrets + the other values

# 3. Start n8n plus a public tunnel (Convex cloud must be able to reach the webhook)
docker compose --profile tunnel up -d
docker compose logs tunnel        # copy the https://<random>.trycloudflare.com URL

# 4. Import the three workflows (keeps their ids so the error workflow link works)
npm run n8n:import

# 5. Point Convex at the webhook
npx convex env set N8N_REQUEST_WEBHOOK_URL https://<random>.trycloudflare.com/webhook/lendloop-request-events
```

Then open http://localhost:5678, create the n8n owner account, and **activate** "LendLoop - Request
notification" and "LendLoop - Overdue reminders".

## Environment variables

| Variable                             | Where                   | Purpose                                                   |
| ------------------------------------ | ----------------------- | --------------------------------------------------------- |
| `NEXT_PUBLIC_CONVEX_URL`             | `.env.local`            | Convex client URL (written by `npx convex dev`).          |
| `CONVEX_DEPLOYMENT`                  | `.env.local`            | Convex dev deployment name (written by `npx convex dev`). |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`  | `.env.local`            | Clerk publishable key (browser safe).                     |
| `CLERK_SECRET_KEY`                   | `.env.local`            | Clerk secret key (server only).                           |
| `CLERK_FRONTEND_API_URL`             | Convex env              | Issuer Convex trusts for Clerk JWTs.                      |
| `CLERK_WEBHOOK_SIGNING_SECRET`       | Convex env              | Verifies Clerk user webhooks (Svix signature).            |
| `N8N_REQUEST_WEBHOOK_URL`            | Convex env              | n8n webhook URL for request events.                       |
| `LENDLOOP_TO_N8N_SECRET`             | Convex env + `n8n/.env` | HMAC secret, Convex to n8n.                               |
| `N8N_TO_LENDLOOP_SECRET`             | Convex env + `n8n/.env` | HMAC secret, n8n to Convex.                               |
| `N8N_TO_LENDLOOP_SECRET_PREVIOUS`    | Convex env (optional)   | Old n8n to Convex secret, accepted only during rotation.  |
| `N8N_ENCRYPTION_KEY`                 | `n8n/.env`              | Encrypts n8n credentials at rest.                         |
| `LENDLOOP_CONVEX_SITE_URL`           | `n8n/.env`              | Convex HTTP actions base URL (`.convex.site`).            |
| `LENDLOOP_ALERT_WEBHOOK_URL`         | `n8n/.env` (optional)   | Slack or Discord webhook for failed-run alerts.           |
| `LENDLOOP_SIMULATE_REMINDER_FAILURE` | `n8n/.env` (optional)   | `true` to demo the reminder failure path.                 |

Generate secrets with `openssl rand -hex 32`. No secret is ever committed; `.env*` files are git
ignored except the examples.

## Architecture

See [docs/architecture.md](docs/architecture.md) for the full picture. In short:

- Routes (`convex/http.ts` and Convex function names) call controllers (thin query and mutation
  handlers), which call services (business rules), which call models (the only code that touches
  the database). An ESLint rule blocks `ctx.db` outside `convex/models`.
- Authorization is enforced inside Convex functions, not only in the UI.
- Convex to n8n events go through a transactional outbox with retries.

## Security and data minimization

The full design is in [docs/architecture.md](docs/architecture.md), sections 4 and 5. What matters
most:

**Authentication**

- Clerk handles sign-in. `src/proxy.ts` runs `clerkMiddleware()`, and the signed-in route group
  calls `auth.protect()` on the server, so signed-out visitors never render a signed-in page.
- Convex verifies the Clerk JWT (signature, issuer, `convex` audience, expiry) on every call. User
  records are created from verified token claims, never from client arguments.
- The Clerk webhook is verified with Svix (signature and timestamp) before the body is parsed.

**Authorization**

- Every Convex query and mutation resolves the caller with `requireUser` or `requireAdmin` and
  checks a pure policy function (`convex/services/policy.ts`). The UI hides buttons for comfort
  only; the server is the gate. Tests call functions as the wrong user to prove it.
- Roles live in Convex. No public function changes a role; the first admin is promoted with an
  internal mutation that only someone with deployment access can run.
- Only `convex/models` may touch `ctx.db` (ESLint enforced), so no controller can skip a service
  and its checks.

**Integration security (Convex and n8n)**

- Both directions are signed with HMAC-SHA256 over the timestamp and raw body (inbound also covers
  method and path), with a 5 minute replay window and constant-time comparison. Each direction has
  its own secret.
- Convex rejects unsigned or stale requests with 401 before reading any data, caps bodies at 4 KB,
  validates every field, and checks that ids from n8n belong to the right table.
- Write-backs are idempotent (`reminder:<requestId>:<day>`, `notification:<eventId>`), so n8n
  retries never create duplicates. The notification workflow also dedupes by event id.
- Secrets live only in Convex env and `n8n/.env` (read by Code nodes through `$env`). Exported
  workflow JSON contains no secrets, and CI fails if it ever does
  (`scripts/check-workflow-secrets.mjs`).
- Secret rotation without downtime: set `N8N_TO_LENDLOOP_SECRET_PREVIOUS` to the old value, update
  the secret in Convex, then in n8n, then remove the previous value.

**Abuse limits and safe errors**

- Server-side length limits on all text, at most 30 day loans booked up to 180 days ahead, at most
  50 listed tools per person and 10 pending requests per borrower.
- Errors sent to the browser are typed (`AppError` codes) with plain messages. Stack traces and
  internal details stay in server logs. The route error page shows only a reference id.
- Security headers: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`,
  `Permissions-Policy`, and no `X-Powered-By`.

**Data minimization**

| Where                      | What is shared                                                       | What is never shared                     |
| -------------------------- | -------------------------------------------------------------------- | ---------------------------------------- |
| Public landing page        | Name and category of available tools                                 | Owners, descriptions, loan details       |
| Browse and request screens | Lender display name and Trusted Lender badge                         | Emails or any contact details            |
| Admin screens              | Names, roles, loans, delivery status                                 | Emails                                   |
| Notification event to n8n  | Event id and type, recipient first name and email, tool name, dates  | The other party's email, user ids, roles |
| Overdue endpoint for n8n   | Request id, borrower first name and email, tool name, end date, days | Owner details, messages, history         |
| Logs (Convex and n8n)      | Event ids and outcomes, emails masked (`b***@example.com`)           | Full emails, secrets, signatures         |

- Outbox rows hold a recipient email, so a daily job deletes delivered rows after 7 days and failed
  ones after 30.
- When a Clerk user is deleted, the webhook removes their name and email from LendLoop and marks
  the profile deleted. Deleted users are never contacted.
- n8n keeps execution data for 14 days (`EXECUTIONS_DATA_MAX_AGE`).

## n8n workflows

Three workflows live in `n8n/workflows/` as exported JSON. Their Code node logic is kept as plain,
reviewed and unit tested files in `n8n/code/`, and `npm run n8n:build` regenerates the JSON from them.
A test fails if the JSON and the code drift apart.

| Workflow                            | Trigger                                         | What it does                                                                                                                                                          |
| ----------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **LendLoop - Request notification** | Webhook `POST /webhook/lendloop-request-events` | Verifies the HMAC signature and timestamp, skips duplicate `eventId`s, builds a short message, sends it (mock log), then writes `notification_sent` back to LendLoop. |
| **LendLoop - Overdue reminders**    | Daily at 09:00 (plus a manual trigger)          | Signs and calls `GET /n8n/overdue-loans`, sends one reminder per borrower (mock log), and writes `reminder_sent` or `reminder_failed` back for each loan.             |
| **LendLoop - Error handler**        | Error Trigger                                   | Both workflows point to it. Logs the failed workflow, node, message and execution URL, and posts to Slack or Discord when `LENDLOOP_ALERT_WEBHOOK_URL` is set.        |

### Events Convex sends

`request.created` (to the owner), `request.approved`, `request.declined` (to the borrower, with a
`reason` when it was auto-declined), `request.cancelled` (to the owner) and `request.returned` (to the
borrower). Example payload, which is everything the workflow receives:

```json
{
  "eventId": "6f0c...",
  "eventType": "request.approved",
  "occurredAt": 1794900000000,
  "requestId": "k57...",
  "recipient": { "role": "borrower", "firstName": "Ben", "email": "ben@example.com" },
  "counterpart": { "firstName": "Olivia" },
  "tool": { "name": "Cordless drill" },
  "dates": { "start": "2026-11-18", "end": "2026-11-20" }
}
```

### Endpoints n8n calls

| Endpoint                      | Purpose                                                                                                                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /n8n/overdue-loans`      | Approved loans past their end date that have not had a reminder today. Fields: request id, borrower first name and email, tool name, end date, days overdue, idempotency key. |
| `POST /n8n/automation-events` | Write-back `{ requestId, kind, idempotencyKey, detail? }`. Returns `200 {status:"created"}` or `200 {status:"duplicate"}` for a retry.                                        |

Both live on the Convex HTTP actions URL (`https://<deployment>.convex.site`) and reject anything
without a valid signature and fresh timestamp (`401`).

### Reliability

- **Outbox with retries.** Convex writes the event in the same transaction as the status change, then
  delivers it from a scheduled action: 5 attempts with backoff (30s, 2m, 8m, 32m), a lease so an event
  is never sent twice at once, and a cron sweep every 5 minutes as a safety net. 4xx responses are not
  retried. Permanently failed events show on the **Admin** page with a **Retry** button.
- **Idempotency.** n8n deduplicates on `eventId`. Write-backs use `notification:<eventId>` and
  `reminder:<requestId>:<YYYY-MM-DD>` keys, and Convex stores each key once (serializable mutations),
  so retries never create duplicate records or reminders.
- **n8n retries.** HTTP nodes and the send nodes use Retry On Fail. A reminder that still fails goes
  down the error branch and records `reminder_failed`; an unexpected failure triggers the error workflow.
- **Visible activity.** Each loan shows its latest automation steps, for example "Reminder sent 2 days
  ago", in My requests, Incoming requests and the admin loans table.

### Try it

1. Request a tool as one user. In n8n, **Executions** shows a run of "Request notification",
   `docker compose logs n8n` shows `[LendLoop mock notification]`, and the request shows
   "Notification sent just now".
2. Approve it, then in the Convex dashboard (**Data > borrowRequests**) set its `endDate` to a past
   date. Open "Overdue reminders" in n8n and click **Execute workflow**. The loan shows "Reminder sent
   just now". Run it again: nothing new is sent (already reminded today).
3. Failure path: set `LENDLOOP_SIMULATE_REMINDER_FAILURE=true` in `n8n/.env`, run
   `docker compose up -d`, execute the workflow again for another overdue loan. The loan shows
   "Reminder failed".
4. Delivery failure: stop n8n (`docker compose stop n8n`) and approve a request. After the retries the
   Admin page lists the failed delivery. Start n8n again and click **Retry**.

The quick tunnel URL changes every time the tunnel restarts. Update `N8N_REQUEST_WEBHOOK_URL` when it
does (production uses a stable domain).

## Testing

```bash
npm run check     # lint + typecheck + tests
npm test          # unit tests and convex-test function tests
```

## Troubleshooting

| Symptom                                                                                  | Cause and fix                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Browser console loops on `WebSocket closed with code 1006` and the page looks signed out | A browser extension (ad blocker, privacy or VPN extension) or antivirus web shield is blocking the Convex WebSocket. Allow `localhost` and `*.convex.cloud`, or test in a private window.                    |
| Yellow banner "the LendLoop server didn't accept your session"                           | `CLERK_FRONTEND_API_URL` is missing or wrong on the Convex deployment, or the Convex integration is not activated in Clerk. Check with `npx convex env list`.                                                |
| n8n exits with `Mismatching encryption keys`                                             | `N8N_ENCRYPTION_KEY` was set or changed after n8n first started, and n8n already saved a different key in its volume. Restore the original value, or comment the line out so n8n keeps using the saved key.  |
| Admin "Automation health" shows `n8n responded 404`                                      | `N8N_REQUEST_WEBHOOK_URL` does not match the published webhook. It must be `https://<tunnel>/webhook/lendloop-request-events`, the tunnel host changes on every restart, and the workflow must be published. |
| n8n execution fails at "Record notification in LendLoop" with "not found"                | `LENDLOOP_CONVEX_SITE_URL` in `n8n/.env` is wrong. Use your deployment's `.convex.site` URL (not `.convex.cloud`), then run `docker compose up -d --force-recreate n8n`.                                     |

## Running in production

This take-home runs everything locally with a Cloudflare quick tunnel and mock notifications. For
a real launch I would change the following.

**Environments and deploys**

- Separate Clerk and Convex production instances. CI runs lint, typecheck and tests, then
  `npx convex deploy` and the Vercel deploy, so schema and functions ship together.
- Secrets in a secret manager (or the platform env stores), never in files on a laptop.

**n8n**

- Self-host on a managed container platform (or n8n Cloud) with Postgres instead of SQLite, queue
  mode with Redis and at least one worker, HTTPS on a stable domain instead of a quick tunnel, and
  SSO or basic auth in front of the editor. Set `N8N_ENCRYPTION_KEY` once and back it up.
- Keep workflows in Git as they are now (`n8n/code` plus generated JSON) and import them in the
  deploy pipeline, so production is never edited by hand.
- Replace the mock notification node with a real provider (Postmark, SES or Resend) using an n8n
  credential, with a verified sending domain (SPF, DKIM, DMARC) and an unsubscribe link.

**Reliability and monitoring**

- Sentry on the Next.js app and Convex functions, and n8n failure alerts to Slack (the error
  workflow already supports `LENDLOOP_ALERT_WEBHOOK_URL`).
- Alert when the outbox has failed deliveries or pending ones older than 15 minutes. The Admin
  Automation health panel already shows both.
- Add a reconciliation job that compares overdue loans with recorded reminders, in case n8n is down
  for a full day.

**Security hardening**

- Enforce a strict Content Security Policy built from Clerk's documented directives plus the Convex
  domains (currently left out so local development with Clerk dev instances keeps working).
- Rate limit the public HTTP routes at the edge and add per-user rate limits on mutations (for
  example with the Convex rate limiter component).
- Rotate HMAC secrets on a schedule using the previous-secret support.
- Move from a static board to a real neighborhood model (invite codes or verified addresses) before
  opening sign-ups to the public.

**Data**

- Pagination instead of the current 200 row caps once a neighborhood grows.
- A written retention policy, a data export and delete flow for users, and a privacy notice.
