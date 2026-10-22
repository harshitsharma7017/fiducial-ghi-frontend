# Separation from Fiducial_frontend (22 Oct 2026)

Fiducial_frontend used to hold every product. It is now two independent Next.js apps on the same, unchanged
Fiducial_backend:

| App                       | Products                                                                                  |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| **Fiducial_frontend**     | Property, Fire and Burglary: Data Sheet, RFQ, quotes, QCR, placement slip, renewals       |
| **fiducial-ghi-frontend** | GMC/GHI, GPA, GTLI, group health claims and TPA claims, claims analysis, renewal analysis |

Nothing was rewritten. The Employee Benefits code was copied byte for byte from Fiducial_frontend at commit `7b68927`
and then removed there; the only edits are where the two products met (listed below). Fiducial_backend was not
changed.

## How the split was decided

Files were classified by their import graph from each route, not by folder name. A file reached only from Employee
Benefits routes moved; a file reached only from Property routes stayed; a file reached from both is shared and is in
both apps. After the edits, the graph was run again in each app and every file no longer reached was removed (none of
them was Property code in this app, or Employee Benefits code in Fiducial_frontend).

### Routes

| Moved here (removed from Fiducial_frontend)                                                     |
| ----------------------------------------------------------------------------------------------- |
| `/ghi`, `/ghi/new`, `/ghi/{id}`; `/eb/{product}`, `/eb/{product}/{id}`                          |
| `/claims`, `/claims/{id}`, `/claims/new`, `/claims/links`, `/claims/settings`, `/claims/tpa/**` |
| `/claims-analysis`, `/renewal`, `/masters/family-plans/**`, `/masters/age-bands`                |
| `/claim` (public employee link) and `/api/public/claim-link/**`                                 |

| In both apps (shared)                                                                                |
| ---------------------------------------------------------------------------------------------------- |
| Sign-in, sign-out, profile, the shell (sidebar, navbar, palette, notifications, theme), `PageGate`   |
| The BFF (`/api/auth/*`, `/api/proxy/*`, `src/lib/server/`), mock mode                                |
| `/masters/clients` (and `/{id}`), `/masters/insurers`, `/masters/email-templates` (GHI mail uses the |
| same RFQ/QCR templates), `/users`, `/audit`, `/settings`                                             |
| `src/shared/` (the whole backend contract, kept identical by `npm run shared:check`), `ui/` kit      |

Property-only routes (`/dashboard`, `/proposals/**`, `/rfq`, `/quotes`, `/placement-slips`, and the masters for
occupancy, occupancy defaults, pincodes, policies, sections, add-ons, tax rates, notes, clauses, document templates
and Import data) are not in this app.

### Components and libraries moved

`components/ghi/`, `components/eb/`, `components/claims/`, `components/tpa/`, `components/reports/`,
`components/family-plans/`, `components/age-bands/`, `components/clients/{employees-card,employee-dialog,
plan-defaults-card}.tsx`, `lib/api/{ghi,claims,tpa,reports}.ts`, `lib/eb/`, `lib/server/claim-link-paths.ts`, with
their tests (`ghi.test`, `eb.test`, `n4-n7.test`, `claims.test`, `tpa.test`, `lib/eb/*.property.test`,
`claim-link-paths.test`).

## Edits where the products met

| File                                       | Fiducial_frontend                                                                               | fiducial-ghi-frontend                                                |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `components/layout/nav-config.ts`          | Employee Benefits, Claims, Reports, Family plans and Age bands removed                          | Only Employee Benefits, Claims, Reports, the masters they use, Admin |
| `/proposals/new` (`new-proposal-view.tsx`) | Opens the Property form directly (no Property / EB choice)                                      | (not in this app)                                                    |
| `components/eb/new-case-chooser.tsx`       | (removed)                                                                                       | Product choice only; `/ghi/new?product=GPA` preselects               |
| `eb/[product]/eb-list-view.tsx` New case   | (removed)                                                                                       | Links to `/ghi/new?product=…` (was `/proposals/new?line=eb…`)        |
| `masters/clients/[id]` page                | Client and risk locations                                                                       | Client, default plans and employees                                  |
| `lib/api/notifications.ts` links           | GMC/GPA/GTLI cases → `NEXT_PUBLIC_GHI_APP_URL`, else none                                       | Property proposals → `NEXT_PUBLIC_PROPERTY_APP_URL`, else none       |
| `lib/server/proxy-paths.ts` allowlist      | Without `ghi`, `eb`, `family-plans`, `age-bands`, `claims`, `tpa`, `claims-analysis`, `renewal` | Without `imports`, `catalog`, `templates`, `qcrs`, `placement-slips` |
| `proxy.ts`, home                           | `/claim` no longer public                                                                       | Home and post-sign-in page are `/ghi` (was `/dashboard`)             |
| `next.config.ts`                           | Redirects `/claim` to the GHI app when its URL is set                                           | unchanged                                                            |
| Breadcrumbs, command palette               | unchanged                                                                                       | No proposal lookups (palette searches pages only)                    |
| `components/ghi/line-of-business.tsx`      | (removed)                                                                                       | Removed: the Property / EB choice no longer exists                   |

Tests that encode navigation, the home page or the allowlist were updated to each app's new behaviour; the test of
the Property / EB choice (`LineOfBusinessChoice`) was removed with the component. No test of a migrated feature was
changed except `notifications-menu.test` here, which now uses a GMC notification. New tests: `lib/api/notifications.test.ts`
in both apps (cross-app links, unset and unsafe URLs).

## Product status (what exists; nothing new was built)

- **GMC / GHI**: New → Data Sheet → census (import with row errors, invalid-row report, members by hand) → RFQ →
  quotes → QCR with approval → payments → placement slip. Claims board (four columns) and table, claim details,
  documents, remarks, status history with actor and time, emails sent, claimant and HR notifications from templates an
  Admin edits (Claims › Settings), employee submission links, TPA import and formats.
- **GPA and GTLI**: the same case workflow in `components/eb/` (Data Sheet with GPA relationship rules and GTLI/GPA
  salary basis, family plan, census, RFQ with the selection summary, quotes, QCR, client decision, payments, placement
  slip). Claims and the claims board are group health only; the analyses filter by product.
- **Gaps, unchanged by the move**: there is no Employee Benefits dashboard (Property's dashboard counts proposals only),
  so this app opens on the GMC list. There is no case search in the palette. The census templates are provisional.
  The New case form's Cancel always goes to `/ghi`, also for GPA and GTLI (as before).

## Configuration

| Variable                        | App                   | Notes                                                            |
| ------------------------------- | --------------------- | ---------------------------------------------------------------- |
| `API_URL`                       | both                  | Server only. The same backend for both.                          |
| `USE_MOCK_API`, `COOKIE_SECURE` | both                  | As before.                                                       |
| `NEXT_PUBLIC_GHI_APP_URL`       | Fiducial_frontend     | Optional, public, build time. Links and `/claim` redirect.       |
| `NEXT_PUBLIC_PROPERTY_APP_URL`  | fiducial-ghi-frontend | Optional, public, build time. Links from Property notifications. |

No backend setting changes: the BFF calls the API server to server, so `CORS_ORIGIN` does not need the new origin, and
claim links are built from the browser's own origin.

## Remaining steps (not done)

1. Review and commit both repositories (nothing has been committed or pushed).
2. Deploy this app: VPS directory, `.env.local` from `.env.production.example`, a PM2 entry on port 3002 (the root
   `ecosystem.config.cjs` was not changed), an Nginx host with HTTPS. Then set `NEXT_PUBLIC_GHI_APP_URL` in
   Fiducial_frontend and `NEXT_PUBLIC_PROPERTY_APP_URL` here, and rebuild both.
3. Tell staff the new address for Employee Benefits and claims. Claim links made before the move keep working once
   `NEXT_PUBLIC_GHI_APP_URL` is set in Fiducial_frontend.
4. `.env.production.example` is ignored by `.gitignore` (`.env.*` except `.env.example`) in both repos, as it already
   was in Fiducial_frontend; un-ignore it if it should be committed.
5. `src/shared` now has two frontend copies: run `npm run shared:sync` in both after a contract change.
