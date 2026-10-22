# Fiducial GHI frontend

Next.js web app for **Fiducial Employee Benefits**, built by Spirezen Enterprises for Fiducial Insurance Brokers:

- **GMC / GHI**: Group Health (Mediclaim), with the group health **claims** board
- **GPA**: Group Personal Accident
- **GTLI**: Group Term Life Insurance

Property, Fire and Burglary insurance live in the separate **Fiducial_frontend** repository. Both frontends use the
same API, **Fiducial_backend**, unchanged. The browser never calls the API directly: this app's own server routes (a
backend-for-frontend) hold the session and forward each call. [docs/MIGRATION.md](docs/MIGRATION.md) records how this
app was separated from Fiducial_frontend and what is still open.

Project documents and open questions live in the backend repository: `docs/` and `docs/OPEN_ITEMS.md` there
(`../Fiducial_backend/docs` when the repos are side by side).

## Prerequisites

- Node.js 24 LTS (`nvm use` reads `.nvmrc`) and npm 11
- Fiducial_backend running (http://localhost:4000 by default) with an admin seeded. Its README covers it.

## First run

```sh
nvm use
npm install
cp .env.example .env.local    # API_URL=http://localhost:4000, USE_MOCK_API=false for the real API
npm run dev                   # http://localhost:3002 (Fiducial_frontend uses 3000)
```

Sign in with a user seeded in Fiducial_backend; the same users and roles work in both frontends. Signing in opens the
GMC cases (`/ghi`).

Running both frontends on `localhost` at once: browsers share cookies across ports, so both apps see the same session
cookie. That works (it is the same API token), but signing out of one signs out of the other. In production each app
has its own host and its own `__Host-` cookie.

## Demo mode (no backend)

Set `USE_MOCK_API=true` in `.env.local` to run the app without Fiducial_backend. The sign-in route then accepts five
built-in demo users, one per role, and never calls the API; a "Demo mode" badge shows in the navbar. Every demo user has
the password `Fiducial-demo-2026`.

| Email                        | Role                     | Code              |
| ---------------------------- | ------------------------ | ----------------- |
| `demo.admin@example.com`     | Admin                    | `ADMIN`           |
| `demo.manager@example.com`   | Relationship Manager     | `ACCOUNT_MANAGER` |
| `demo.approver@example.com`  | Approver                 | `MANAGER`         |
| `demo.placement@example.com` | Underwriting / Placement | `PLACEMENT_EXEC`  |
| `demo.readonly@example.com`  | Read-only                | `READ_ONLY`       |

Every page that reads live data shows a short "Not available in demo mode" notice instead of calling the API.

## Environment variables

| Variable                       | Where         | Purpose                                                                          |
| ------------------------------ | ------------- | -------------------------------------------------------------------------------- |
| `API_URL`                      | server only   | The Express API, for example `http://localhost:4000`. Never sent to the browser. |
| `USE_MOCK_API`                 | server only   | `true` for demo mode. Never `true` where real users sign in.                     |
| `COOKIE_SECURE`                | server only   | Override for the session cookie's `Secure` flag (defaults to on in production).  |
| `NEXT_PUBLIC_PROPERTY_APP_URL` | public, build | Optional. Fiducial_frontend's URL, so Property notifications link there.         |

`NEXT_PUBLIC_PROPERTY_APP_URL` is inlined into the browser bundle when the app is built: set it before
`npm run build`, and never put a secret in a `NEXT_PUBLIC_` variable. See `.env.example` and
`.env.production.example`.

## Screens

| Area               | Routes                                                                                             |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| GMC (Group Health) | `/ghi`, `/ghi/new`, `/ghi/{id}`                                                                    |
| GPA and GTLI       | `/eb/gpa`, `/eb/gtli`, `/eb/{product}/{id}`; New case opens `/ghi/new?product=GPA` (or `GTLI`)     |
| Claims             | `/claims` (board and table), `/claims/new`, `/claims/{id}`, `/claims/links`, `/claims/settings`    |
| TPA claims         | `/claims/tpa`, `/claims/tpa/import`, `/claims/tpa/formats`                                         |
| Reports            | `/claims-analysis`, `/renewal`                                                                     |
| Masters            | `/masters/clients` (and `/{id}`: plan defaults and employees), `/masters/insurers`,                |
|                    | `/masters/email-templates`, `/masters/family-plans` (and `/{id}`), `/masters/age-bands`            |
| Admin              | `/users`, `/audit`, `/settings`                                                                    |
| Public             | `/claim#t=<token>`: the employee's claim submission link (no sign-in; the token is the credential) |

- **GMC cases** (`components/ghi/`): Data Sheet, employee census (import with row-level errors and an error report,
  members by hand), RFQ to insurers, quotes, QCR with approval, payments and the placement slip.
- **GPA and GTLI cases** (`components/eb/`): Data Sheet (validated by the shared schema before saving), family plan
  card, census with the provisional template download, import (mode, policy chosen explicitly, row corrections, error
  report) and members by hand, RFQ with the selection summary, quotes (GST and totals from the API), QCR with
  approval, the client's decision, payments and the placement slip. API calls go to `/api/v1/eb/{gpa,gtli}/cases/...`.
- **Claims** (`components/claims/`): the four-column board and the table, a claim's details, documents, remarks,
  status history (who and when) and the emails sent; status changes email the claimant and the company's HR contact
  with the backend's templates, which an Admin edits on **Claims › Settings**. Submission links for employees are made
  on **Claims › Links**; their URL is this app's origin.
- **TPA claims** (`components/tpa/`), **claims analysis** and **renewal analysis** (`components/reports/`).
- **Company page** (`/masters/clients/{id}`): the employees shared by the company's GMC, GPA and GTLI cases and the
  default plan per product. Clients' risk locations belong to Property and are managed in Fiducial_frontend.
- **Templates**: the seven census templates are provisional (no client format received); every download says so.

## Roles and permissions

What each role may do is one table, `src/shared/permissions.ts`, shared with the API.

| Screen or action                                             | Admin | Approver | Relationship Manager | Underwriting / Placement | Read-only |
| ------------------------------------------------------------ | ----- | -------- | -------------------- | ------------------------ | --------- |
| EB lists and cases (GMC, GPA, GTLI), company employees       | yes   | yes      | yes                  | yes                      | yes       |
| New Employee Benefits case                                   | yes   |          | yes                  |                          |           |
| EB case edits, census, payments, placement, employees        | yes   |          | yes                  | yes                      |           |
| EB RFQ and QCR approval                                      | yes   | yes      |                      |                          |           |
| Family plans and company default plans (view)                | yes   | yes      | yes                  | yes                      | yes       |
| Family plans: create, edit, activate, confirm, deactivate    | yes   |          |                      |                          |           |
| Company default plans (change)                               | yes   |          | yes                  |                          |           |
| Age bands (view)                                             | yes   | yes      | yes                  | yes                      | yes       |
| Age bands: create, edit, activate, deactivate                | yes   |          |                      |                          |           |
| Choose a case's age bands                                    | yes   |          | yes                  | yes                      |           |
| Claims, TPA claims, claims analysis (view)                   | yes   | yes      | yes                  | yes                      |           |
| Diagnosis details (diagnosis, ICD code, rejection reason)    | yes   |          | yes                  | yes                      |           |
| Import TPA files, review and link TPA claims                 | yes   |          | yes                  | yes                      |           |
| TPA formats, import email settings, full bank accounts       | yes   |          |                      |                          |           |
| Endorsement premiums, record past policy years, save reports | yes   |          | yes                  | yes                      |           |
| Renewal analysis (view)                                      | yes   | yes      | yes                  | yes                      | yes       |
| Renewal and claims analysis downloads                        | yes   | yes      | yes                  | yes                      |           |
| Users, Audit log, Settings                                   | yes   |          |                      |                          |           |

- Navigation shows only the items a user's permissions allow (`src/components/layout/nav-config.ts`).
- Opening a page without its permission shows "You do not have access" inside the shell (`PageGate`), and the page
  sends no requests.
- The API checks the same permission on every route, so the screens are a convenience, not the security boundary.

## How it talks to the API

- `POST /api/auth/login` signs in against the API and keeps the access token in an httpOnly cookie (`erp_session`;
  `__Host-erp_session` in production), SameSite=Lax, that expires with the token. The browser receives only the user.
- `POST /api/auth/logout` tells the API (for the audit log) and clears the cookie, even if the API is unreachable.
- `/api/proxy/<path>` forwards to `/api/v1/<path>` with the token as a bearer header. Only the areas this app uses are
  allowed (`src/lib/server/proxy-paths.ts`): `users`, `masters`, `clients`, `insurers`, `email-templates`, `mail`,
  `notifications`, `proposals` (case owners and the email template preview), `ghi`, `eb`, `family-plans`,
  `age-bands`, `claims`, `tpa`, `claims-analysis`, `renewal`, `health`, `audit` and `auth/me`. No cookie gives 401, a
  path outside the list gives 404, a cross-origin write gives 403, and a 401 from the API clears the cookie.
- `/api/public/claim-link/...` forwards the employee claim link's calls to `/api/v1/claim-links/current/...` with the
  link token; only the link, its claims and claim documents are reachable.
- `src/proxy.ts` (Next.js 16's replacement for middleware) sends signed-out visitors to `/login`.
- The BFF calls the API server to server, so the backend's `CORS_ORIGIN` does not need this app's origin.

## Shared contracts

`src/shared/` is an exact copy of `Fiducial_backend/src/shared/`: the request and response schemas, enums, types and
display formatters. It is the whole contract, including the Property files, so that it stays byte-identical to the
backend. Do not edit it here. Change the backend, then run:

```sh
npm run shared:sync    # reads ../Fiducial_backend; set FIDUCIAL_BACKEND_DIR to use another checkout
npm run shared:check   # lists any difference and exits 1
```

and commit the change in every repo that holds the copy (Fiducial_frontend too).

## Scripts

| Command                       | Does                                                                     |
| ----------------------------- | ------------------------------------------------------------------------ |
| `npm run dev`                 | Next.js dev server on port 3002                                          |
| `npm run build` / `npm start` | Production build / serves it (`PORT`, default 3000; set 3002)            |
| `npm run lint`                | ESLint (Next.js core web vitals, type-aware TypeScript) and Prettier     |
| `npm run typecheck`           | `next typegen` (route types), then `tsc --noEmit`                        |
| `npm test`                    | Vitest with Testing Library (jsdom)                                      |
| `npm run test:e2e`            | Playwright smoke test (Chromium): builds, starts in demo mode on 3102    |
| `npm run shared:check`        | Compares `src/shared` with the backend's copy; exits 1 if they differ    |
| `npm run shared:sync`         | Copies the backend's `src/shared` here (adds, updates and removes files) |

## Deployment

The app deploys on its own, next to Fiducial_frontend and Fiducial_backend. On the VPS layout that
`../DEPLOYMENT.md` describes (backend on 5001, Property frontend on 3001), for example:

```sh
cd /var/www/fiducial/fiducial-ghi-frontend
cp .env.production.example .env.local   # then set API_URL, COOKIE_SECURE, NEXT_PUBLIC_PROPERTY_APP_URL
npm ci && npm run build
PORT=3002 npm start                     # or a PM2 app: script node_modules/next/dist/bin/next, args "start -p 3002"
```

and a reverse proxy (its own host name, for example `ghi.example.com`) to port 3002 over HTTPS. None of this has been
set up yet; see [docs/MIGRATION.md](docs/MIGRATION.md) for the steps that remain.

## Conventions

- **Amounts and rates stay strings.** Never convert them to floats. Display them with the shared formatters.
- **Server state** goes through React Query (keys in `src/lib/query-keys.ts`); forms use React Hook Form with the
  shared Zod schemas.
- **UI**: shadcn-style components on Radix (`radix-ui`), Tailwind CSS 4 and lucide icons. Every input has a label;
  loading and error states use `role="status"` and `role="alert"` (`src/components/states.tsx`).

## Security notes

- The JWT is never readable by browser JavaScript: it sits in an httpOnly cookie and only this app's server adds it
  to API calls.
- State-changing BFF routes also check the `Origin` header, on top of SameSite=Lax.
- `next.config.ts` sets X-Frame-Options, X-Content-Type-Options, Referrer-Policy and Permissions-Policy.
- Serve over HTTPS in production; the `__Host-` cookie requires it.

## Troubleshooting

- "The server is not reachable" (502, `UPSTREAM_UNAVAILABLE`): the API is not running at `API_URL`.
- An error naming `API_URL`: `.env.local` is missing or the value is not a URL.
- "No master data is active yet" (the client form's occupancy): the IIB master is imported and activated in
  Fiducial_frontend (**Masters › Import data**); both apps read the same API.
