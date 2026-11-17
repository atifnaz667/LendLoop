# LendLoop

> Borrow what you need. Lend what you don't.

A neighborhood tool-lending board. Neighbors list tools they are willing to lend, request to borrow
from each other, and get automated notifications and overdue reminders handled by n8n.

**Stack:** Next.js 16 (App Router) + TypeScript, Clerk, Convex, n8n (self-hosted in Docker), Tailwind CSS.

> This README grows with each module. Sections marked _(coming in module N)_ are planned in
> [docs/roadmap.md](docs/roadmap.md).

## Contents

- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Architecture](#architecture)
- [Security and data minimization](#security-and-data-minimization)
- [n8n workflows](#n8n-workflows)
- [Testing](#testing)
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

### 6. n8n

```bash
cp n8n/.env.example n8n/.env      # fill in the values
docker compose up -d              # http://localhost:5678
```

Workflow import and the Convex webhook URL setup are described in
[n8n workflows](#n8n-workflows) _(coming in module 5)_.

## Environment variables

| Variable                            | Where                   | Purpose                                                   |
| ----------------------------------- | ----------------------- | --------------------------------------------------------- |
| `NEXT_PUBLIC_CONVEX_URL`            | `.env.local`            | Convex client URL (written by `npx convex dev`).          |
| `CONVEX_DEPLOYMENT`                 | `.env.local`            | Convex dev deployment name (written by `npx convex dev`). |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `.env.local`            | Clerk publishable key (browser safe).                     |
| `CLERK_SECRET_KEY`                  | `.env.local`            | Clerk secret key (server only).                           |
| `CLERK_FRONTEND_API_URL`            | Convex env              | Issuer Convex trusts for Clerk JWTs.                      |
| `CLERK_WEBHOOK_SIGNING_SECRET`      | Convex env              | Verifies Clerk user webhooks (Svix signature).            |
| `N8N_REQUEST_WEBHOOK_URL`           | Convex env              | n8n webhook for request events _(module 5)_.              |
| `LENDLOOP_TO_N8N_SECRET`            | Convex env + `n8n/.env` | HMAC secret, Convex to n8n _(module 5)_.                  |
| `N8N_TO_LENDLOOP_SECRET`            | Convex env + `n8n/.env` | HMAC secret, n8n to Convex _(module 5)_.                  |
| `N8N_ENCRYPTION_KEY`                | `n8n/.env`              | Encrypts n8n credentials at rest.                         |
| `LENDLOOP_CONVEX_SITE_URL`          | `n8n/.env`              | Convex HTTP actions base URL (`.convex.site`).            |

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

_(Completed in module 6; design is in [docs/architecture.md](docs/architecture.md), sections 4 and 5.)_

## n8n workflows

_(coming in module 5)_

## Testing

```bash
npm run check     # lint + typecheck + tests
npm test          # unit tests and convex-test function tests
```

## Troubleshooting

| Symptom                                                                                  | Cause and fix                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser console loops on `WebSocket closed with code 1006` and the page looks signed out | A browser extension (ad blocker, privacy or VPN extension) or antivirus web shield is blocking the Convex WebSocket. Allow `localhost` and `*.convex.cloud`, or test in a private window. |
| Yellow banner "the LendLoop server didn't accept your session"                           | `CLERK_FRONTEND_API_URL` is missing or wrong on the Convex deployment, or the Convex integration is not activated in Clerk. Check with `npx convex env list`.                             |

## Running in production

_(Completed in module 6; summary in [docs/roadmap.md](docs/roadmap.md).)_
