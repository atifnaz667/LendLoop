# Roadmap

Work is delivered module by module. Each module is one branch and one PR, and leaves the app in a
working state.

| #   | Module                    | Branch                 | Scope                                                                                                                                                                                                                                                      |
| --- | ------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Foundation                | `chore/foundation`     | Next.js 16 + TypeScript scaffold, Tailwind, Clerk proxy, Convex provider and auth config, schema, ESLint layering rule, Vitest, CI, docker-compose for n8n, CLAUDE.md, architecture.md, roadmap.md, README skeleton.                                       |
| 2   | Auth and roles            | `feat/auth-rbac`       | `users` model and service, `ensureCurrent`, Clerk webhook (Svix verified), `requireUser` / `requireAdmin`, policy module, admin bootstrap via internal mutation, protected `(app)` layout and navigation, tests.                                           |
| 3   | Tools                     | `feat/tools`           | Create, edit, delete own listings, public read-only list (name and category), browse with availability and category filter, My listings, admin remove, Trusted Lender badge, tests.                                                                        |
| 4   | Borrow requests and loans | `feat/borrow-requests` | Request a date range, overlap checks, approve, decline, cancel, mark returned, My requests, Incoming requests, admin All loans, tests.                                                                                                                     |
| 5   | n8n integration           | `feat/n8n-automation`  | HMAC lib, outbox and delivery action with retries, cron sweep, HTTP endpoints (overdue loans, automation events), idempotent write-backs, three workflow JSON exports, activity on each loan ("Reminder sent 2 days ago"), admin automation health, tests. |
| 6   | Polish and docs           | `docs/final-polish`    | README (setup, env vars, architecture, security and data minimization, production notes), UX pass, security review, coverage.                                                                                                                              |

## Production changes (summary, detailed in README)

- Separate Clerk and Convex production instances, `npx convex deploy` from CI.
- n8n on a managed host with Postgres, queue mode, HTTPS and basic auth or SSO in front.
- Real email provider (Postmark, SES or Resend) behind the notification workflow.
- Secret rotation with dual secrets during rollover, stored in a secret manager.
- Strict Content Security Policy, rate limiting on HTTP endpoints, structured logging and alerting
  (Sentry, n8n failure alerts to Slack).
- Retention policy for `automationEvents` and `webhookDeliveries`.

## Out of scope for the take-home

- Real email delivery, maps or location, photos, ratings, in-app chat.
