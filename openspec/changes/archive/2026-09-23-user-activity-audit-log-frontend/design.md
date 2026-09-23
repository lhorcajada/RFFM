## Context

Backend contract (from `openspec/changes/user-activity-audit-log/design.md`, "API Contract (for the front-specialist)" section — authoritative, read in full before implementing):

- `POST /api/audit-log/page-access` — any authenticated role. Body `{ pageIdentifier: string, clubId?: string, teamId?: string }`. `pageIdentifier` reuses the `PagePermission.PageIdentifier` string space (e.g. `"Roster"`), coarse-grained: instrument entry to a *section*, not every internal route change. `200 OK`, empty body. `400` on missing/too-long `pageIdentifier` (`ValidationBehavior` shape).
- `GET /api/audit-log` — `Federation`, `Administrator`, `ClubDirector`, `Coach` only; `403` for everyone else (enforced server-side via route-level `[Authorize(Roles=...)]`, so the frontend guard is defense-in-depth for UX, not the security boundary). Query params: `pageNumber` (default 1), `pageSize` (default 25), `clubId?`, `teamId?`, `userId?`, `eventType?` (one of `PageAccess | ConvocationAccepted | ConvocationRejected | PlayerEdited`), `from?`/`to?` (ISO 8601 UTC). Scope is resolved server-side (Federation/Administrator unfiltered, ClubDirector own clubs, Coach own teams) — the frontend never computes or sends a scope filter, only the optional narrowing params. Response: `UserActivityLogResponse[]` body + `X-Total-Count` header (same convention as `Features/Coaches/News/GetNews.cs`).
- Call-up accept/reject and player-edit events are recorded entirely inside existing backend handlers — this change adds **zero** new calls for those two event types. Only `PageAccess` requires frontend instrumentation.

Existing frontend precedents this design reuses directly:
- `Front/src/apps/federation/routes.tsx` warms up federation settings with a `useEffect` + `warmedUpForUserIdRef` guard-against-double-fire pattern (React 19 dev double-invoke safe) — the page-access hook reuses the same ref-guard shape.
- `Front/src/shared/hooks/usePermissions.ts` — shared hook pattern (`shared/hooks/`, not per-app) for a cross-app concern, already consumed by both `apps/coach/components/RequireFeaturePermission.tsx` and usable from Federation.
- `Front/src/apps/coach/components/RequireFeaturePermission.tsx` + `Front/src/apps/coach/constants/featureRoutes.ts` (`COACH_FEATURE_ROUTES`) — the existing Coach-app pattern for gating a page behind a backend-seeded `FeaturePermission` row, exact precedent set by `player-document-authorizations-frontend` (`PlayerDocuments` route needed backend seeding, flagged as a cross-change dependency — same situation here for `AuditLog`).
- `Front/src/apps/federation/hooks/useIsReadOnlyRole.ts` — the existing pattern for a Federation-app-local role hook backed by `coachAuthService.getRoles()`, since the Federation app has no per-page feature-permission system like Coach's.
- `Front/src/core/router/AppRouter.tsx` gates `/federation/*` at `<RequireAuth requiredRoles={["Federation", "Player", "FamilyMember"]}>` — coarse, app-level. `ClubDirector` and `Coach` are **not** in that list; they operate exclusively through the Coach app (already true today — `ClubManagement`/`ClubPlayers`/`ClubTeams` live under `apps/coach/`). This means the Federation-app audit screen only ever needs to handle the `Federation` role's view (unfiltered — sees everything); `ClubDirector`/`Coach` scoping is entirely the Coach-app screen's concern.
- `Player`/`FamilyMember` **are** allowed into the Federation app shell (per commit `33d3d6fc`/`305bf69b`) but must not reach `GET /api/audit-log` (403 server-side) — so the Federation audit route needs its own `Federation`-only guard nested inside `apps/federation/routes.tsx`, since the app-level `RequireAuth` alone is not enough.
- `.claude/rules/react.md` §4/§10: no `<table>`/MUI `Table` for listings — cards/list, mobile-first, tested at ~360-400px.

## Goals / Non-Goals

**Goals:**
- Instrument every real, existing "section" of both apps (enumerated below) with a one-line `useAuditPageAccess(...)` call, fired once per mount, fire-and-forget, never blocking render or surfacing errors to the user.
- One shared, typed `auditLogService.ts` (no `any`) used by both the hook and the two audit screens.
- A single shared presentational/data-fetching component for the audit list+filters UI, consumed by two thin per-app page wrappers (different guard, different route, same UI/theme-agnostic component) — avoids duplicating filter/pagination/loading/error/empty-state logic in two files.
- Role-gated visibility in both apps: Federation app → `Federation` role only; Coach app → `Coach`/`ClubDirector`/`Administrator` via the existing `FeaturePermission` mechanism, `Player`/`FamilyMember` excluded (`allowPlayerAccess={false}`).
- Full TDD coverage per `frontend-testing.md`: hook tests (mocked service, fire-once behavior), screen tests (loading/error/empty/data, role-gating).

**Non-Goals:**
- No new calls for `ConvocationAccepted`/`ConvocationRejected`/`PlayerEdited` — those are backend-only, already covered by the existing accept/reject and player-edit UI flows with zero frontend change.
- No i18n/locale work beyond existing Spanish-only UI convention (see `feedback_ui_locale_and_mobile` memory: enums/roles always shown in Spanish).
- No retroactive instrumentation of every sub-route/drill-down (e.g. a specific match's Acta, a specific player's rating history) — matches the backend's explicit "coarse-grained, not a router-change listener" instruction. Enumerated below.
- No client-side scope computation — the frontend sends only the optional narrowing filters; the backend is the sole source of truth for what a role may see.
- No changes to the backend `AuditEventType` catalog or `PagePermission.PageIdentifier` seed data — this change only *consumes* those, it does not define or extend them on the backend.

## Decisions

### 1. Enumeration of auditable "sections" — Federation app

Reviewed `Front/src/apps/federation/routes.tsx` (real file, current state). Top-level lazy-loaded routes and the auditable decision for each:

| Route | PageIdentifier | Auditable? | Rationale |
|---|---|---|---|
| `dashboard` | `Dashboard` | Yes | Primary landing section |
| `calendar` | `Calendar` | Yes | Distinct section |
| `classification` | `Classification` | Yes | Distinct section |
| `get-players` | `Squad` | Yes | Distinct section (player roster) |
| `acta/:codacta` | — | **No** | A single match-record detail opened *from* Calendar, not a section a user navigates to directly; logging every match act view would be per-item noise, not per-section access, contradicting the backend's "coarse-grained" instruction |
| `goleadores` | `Goleadores` | Yes | Distinct section |
| `matchday` | `Matchday` | Yes | Distinct section |
| `callups` | `Callups` | Yes | Distinct section |
| `settings` | `Settings` | Yes | Distinct, sensitive (federation-wide config) section |
| `saved-configs` | `SavedConfigs` | Yes | Distinct section |
| `statistics` | `Statistics` | Yes | Distinct section |
| `goal-sectors-comparison` | — | **No** | A specific comparison view reached from Statistics, same "sub-view of a section" reasoning as Acta |
| `error500` | — | **No** | Not a real section, an error boundary page |
| *(new)* `audit-log` | `AuditLog` | Yes | The audit screen itself is a section too — consistent, and useful for meta-audit ("who checked the audit log") |

**11 Federation `PageIdentifier` values**: `Dashboard`, `Calendar`, `Classification`, `Squad`, `Goleadores`, `Matchday`, `Callups`, `Settings`, `SavedConfigs`, `Statistics`, `AuditLog`.

### 2. Enumeration of auditable "sections" — Coach app

Reviewed `Front/src/apps/coach/routes.tsx` (real file, current state). Decision: reuse the **existing `COACH_FEATURE_ROUTES` key names verbatim** as `PageIdentifier` values wherever a route is already gated by `RequireFeaturePermission` — this is a direct, defensible reuse of a taxonomy that already 1:1-maps to "a top-level feature area a user can be granted/denied access to" (exactly the concept `PagePermission.PageIdentifier` models on the backend), rather than inventing a second parallel naming scheme.

| `COACH_FEATURE_ROUTES` key | Route(s) it guards | Auditable? |
|---|---|---|
| `Squad` | `squad` (top-level entry only — `squad/new`, `squad/players-club`, `squad/:id/rating/*`, `player/:id` are sub-actions/drill-downs within Squad, not separate sections) | Yes |
| `Events` | `attendance` (top-level only — `attendance/:id` is a drill-down) | Yes |
| `AttendanceSummary` | `attendance/summary` | Yes |
| `Convocations` | `convocations` (top-level only — `convocations/match` is a drill-down) | Yes |
| `Injured` | `injured` | Yes |
| `Sanctions` | `sanctions` | Yes |
| `Lottery` | `lottery` | Yes |
| `News` | `news` (top-level only — `news/:id` is a drill-down) | Yes |
| `MyDocuments` | `my-documents` | Yes |
| `Rivals` | `rivals` | Yes |
| `Trainings` | `trainings` (top-level only — `trainings/new-exercise`, `trainings/new-session`, `trainings/content-board` are actions/sub-views within it) | Yes |
| `GameModel` | `game-model` (top-level only — `game-model/create`, `game-model/edit` are actions within it) | Yes |
| `SeasonPlan` | (no route currently wired to this key in `routes.tsx` — key exists in constants but unused today) | **Skip** — nothing to instrument; not this change's job to wire up a dangling constant |
| `SeasonAccess` | `season-access` (top-level only — `season-access/prepare` is an action within it) | Yes |
| `Settings` | `settings` | Yes |
| `ClubManagement` | `clubs` (top-level only — `clubs/new`, `clubs/:id/teams/new`, `clubs/:id/teams/:teamId/edit` are actions/sub-views within it) | Yes |
| `ClubPlayers` | `clubs/:id/players` | Yes |
| `ClubTeams` | `clubs/:id/teams` | Yes |
| `ClubRegistrations` | `clubs/:id/registrations` | Yes |
| `PlayerDocuments` | `player-documents` | Yes |
| `TeamRulesDocument` | `team-rules` (top-level only — `team-rules/edit` is an action within it) | Yes |
| `AttendanceConfirmation` | (value is `/mobile/attendance`, a Mobile-only route not reachable from `Front/`) | **Skip** — not a Front route |

Three routes exist in `routes.tsx` with **no** `COACH_FEATURE_ROUTES` guard today (open to any authenticated coach-app user): `dashboard`, `team-dashboard`, `team-users`. These get new `PageIdentifier` values matching their route name, without adding a `FeaturePermission` gate (out of scope — gating them is a separate, unrelated change if ever wanted):

| Route | PageIdentifier |
|---|---|
| `dashboard` | `Dashboard` |
| `team-dashboard` | `TeamDashboard` |
| `team-users` | `TeamUsers` |
| *(new)* `audit-log` | `AuditLog` (new `COACH_FEATURE_ROUTES.AuditLog` key, see Decision 4) |

**23 Coach `PageIdentifier` values total**: the 20 `COACH_FEATURE_ROUTES` keys marked "Yes" above, plus `Dashboard`, `TeamDashboard`, `TeamUsers`, `AuditLog`.

### 3. `useAuditPageAccess` hook — shared, fire-and-forget, ref-guarded

```ts
// Front/src/shared/hooks/useAuditPageAccess.ts
export function useAuditPageAccess(
  pageIdentifier: string,
  options?: { clubId?: string; teamId?: string },
): void {
  const firedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!pageIdentifier) return;
    if (firedForRef.current === pageIdentifier) return;
    firedForRef.current = pageIdentifier;
    void recordPageAccess({
      pageIdentifier,
      clubId: options?.clubId,
      teamId: options?.teamId,
    }).catch(() => {
      // Best-effort audit ping — never surface a failure to the user or block the page.
    });
  }, [pageIdentifier]); // clubId/teamId intentionally excluded: re-firing on every
                          // context resolution would defeat "once per section entry"
}
```

Called as the *first line* of each auditable top-level page component's body: `useAuditPageAccess("Squad")`. `clubId`/`teamId` are passed **only** when a page already has that value trivially at hand from its own existing data-fetch (e.g. a Coach page that already resolved `teamId` for its own rendering) — no new network call is added anywhere solely to populate these two optional audit fields. Pages without cheap access to `clubId`/`teamId` simply omit them (backend fields are nullable; the only cost is that those specific page-access rows won't be filterable by club/team in the audit screen, which is an accepted, documented limitation, not a defect).

**Why a hook, not a `routes.tsx`-centralized listener**: a route-change listener would fire on *every* internal navigation (including the drill-downs explicitly excluded in Decisions 1–2), forcing either a second identifier taxonomy just to distinguish "auditable" from "not" at the router level, or an allowlist of route patterns duplicating the very enumeration this design already produced per-page. A one-line hook call at the top of exactly the ~34 auditable page components is more code sites but each is trivial, self-documenting at the call site, and matches the backend's explicit "instrument entry to a section" framing (a section is a page component, not a URL pattern).

**Why fire-and-forget with a swallowed `.catch`**: page access is telemetry, not a user-facing operation — a failed audit ping (network blip, backend down) must never show an error toast, block rendering, or retry-loop; this mirrors the `federation/routes.tsx` settings-warmup precedent (`.catch(() => {})`).

**Alternative considered**: wrapping this in `apps/<app>/routes.tsx` via a generic `<Route element={<AuditedRoute pageIdentifier="Squad"><Squad/></AuditedRoute>}>` wrapper — rejected as strictly more boilerplate than a hook call for the same 1:1 mapping, and it would obscure the identifier away from the component that best knows its own context (`clubId`/`teamId` availability lives inside the page, not at the route-declaration site).

### 4. Audit-log screen — one shared component, two thin per-app wrappers, two different guards

**Shared presentational + data-fetching component**: `Front/src/shared/components/ui/AuditLogView/AuditLogView.tsx` + co-located `AuditLogView.module.css`. Props:
```ts
type AuditLogViewProps = {
  /** Pre-applied, non-removable filters the caller's role/scope requires (e.g. Coach app may pass nothing — scope is server-side — but could pass a default team filter). */
  fixedFilters?: Partial<AuditLogSearchParams>;
};
```
Owns: filter form (club/team/user/eventType/date-range — only the filters relevant given `fixedFilters`), pagination, loading/error/empty states, and the responsive **card list** (never a `<table>`), each card showing timestamp, role, user, event type (translated to Spanish, see below), action/page, result, reason (if present). Calls `searchAuditLog` from `auditLogService.ts`. Uses MUI theme tokens only (`sx`/theme palette) so it renders correctly in both Federation's light/neon theme and Coach's dark/orange theme without hardcoded colors — same posture as other `shared/components/ui/` components per `react.md` §5.

**Event-type translation**: `AuditEventType` values (`PageAccess`, `ConvocationAccepted`, `ConvocationRejected`, `PlayerEdited`) are backend enum names, not user-facing text — `AuditLogView` maps them to Spanish labels ("Acceso a página", "Convocatoria aceptada", "Convocatoria rechazada", "Ficha de jugador editada") via a local constant map, consistent with the "roles/enums always shown in Spanish" convention.

**Federation wrapper**: `apps/federation/pages/AuditLog/AuditLog.tsx` — no `fixedFilters` (Federation role sees everything unfiltered, per backend scope). Route added in `apps/federation/routes.tsx`:
```tsx
<Route
  path="audit-log"
  element={
    <RequireAuth requiredRoles={["Federation"]}>
      <AuditLog />
    </RequireAuth>
  }
/>
```
using the existing `core/router/RequireAuth` component (already generic, already accepts `requiredRoles`) nested *inside* the Federation app's own `<Routes>` — necessary because the app-level `RequireAuth` in `AppRouter.tsx` already lets `Player`/`FamilyMember` into `/federation/*` broadly; this nested guard is the only thing stopping them from reaching `/federation/audit-log` directly by URL.

**Coach wrapper**: `apps/coach/pages/audit-log/AuditLog.tsx`, gated the same way every other Coach page is:
```tsx
<Route
  path="audit-log"
  element={
    <RequireFeaturePermission featureRoute={COACH_FEATURE_ROUTES.AuditLog} allowPlayerAccess={false}>
      <AuditLog />
    </RequireFeaturePermission>
  }
/>
```
New constant `COACH_FEATURE_ROUTES.AuditLog = "/coach/audit-log"` added to `featureRoutes.ts`. `allowPlayerAccess={false}` blocks `Player`/`FamilyMember` even if a stray `FeaturePermission` row existed (defense-in-depth matching the `PlayerDocuments`/`ConvocationMatchDetail` precedent). **This route is unreachable for `Coach`/`ClubDirector`/`Administrator` until back-specialist seeds a matching `FeaturePermission` row** — flagged in proposal.md Impact and repeated in tasks.md as a blocking cross-team dependency, exact precedent set by `player-document-authorizations-frontend`.

**Why one shared component instead of two independent screens**: the filter/pagination/card-list/empty-state logic is identical business logic regardless of app — duplicating it would violate the "shared reusable UI in `shared/components/ui/`" convention and double the test surface for zero behavioral difference. The only genuine per-app differences (which filters are pre-fixed, which guard wraps it, which route it lives at) are cleanly expressed as thin wrapper components, not duplicated logic.

### 5. `auditLogService.ts` — shared service, typed contracts

`Front/src/shared/services/auditLogService.ts` (shared, not per-app — used identically by both apps' hook instrumentation and both audit screens, same posture as `shared/services/pdfService.ts`/`excelService.ts`):
```ts
export type RecordPageAccessRequest = {
  pageIdentifier: string;
  clubId?: string;
  teamId?: string;
};

export type AuditEventType =
  | "PageAccess"
  | "ConvocationAccepted"
  | "ConvocationRejected"
  | "PlayerEdited";

export type AuditLogSearchParams = {
  pageNumber?: number;
  pageSize?: number;
  clubId?: string;
  teamId?: string;
  userId?: string;
  eventType?: AuditEventType;
  from?: string; // ISO 8601 UTC
  to?: string;   // ISO 8601 UTC
};

export type UserActivityLogResponse = {
  id: string;
  userId: string;
  roleName: string;
  clubId: string | null;
  teamId: string | null;
  timestamp: string;
  ipAddress: string | null;
  eventType: AuditEventType;
  actionOrPage: string;
  result: "Success" | "Failure";
  reason: string | null;
  subjectId: string | null;
};

export type AuditLogSearchResult = {
  items: UserActivityLogResponse[];
  totalCount: number; // parsed from X-Total-Count response header
};

export async function recordPageAccess(request: RecordPageAccessRequest): Promise<void> { /* POST via shared client.ts */ }
export async function searchAuditLog(params: AuditLogSearchParams): Promise<AuditLogSearchResult> { /* GET via shared client.ts, reads X-Total-Count */ }
```
Both functions use the single shared Axios instance (`core/api/client.ts`) — no new instance, no per-component `axios` call.

## Risks / Trade-offs

- **[Risk]** `COACH_FEATURE_ROUTES.AuditLog` has no backend `FeaturePermission` seed row yet — the Coach-app screen is unreachable until back-specialist seeds it (same situation `player-document-authorizations-frontend` hit with `PlayerDocuments`). → **Mitigation**: flagged explicitly in proposal.md Impact and as an early, blocking task in tasks.md so it's requested, not silently discovered late.
- **[Risk]** Pages without cheap access to `clubId`/`teamId` will record `PageAccess` rows with null club/team, making them invisible to a club/team-scoped filter in the audit screen (though still visible to Federation/Administrator's unfiltered view). → **Mitigation**: accepted, documented per-page in Decisions 1–2 rather than forcing an extra data fetch purely for audit metadata on pages that don't already have it.
- **[Risk]** ~34 page components each get a one-line hook-call edit — mechanical but a large diff surface, easy to miss one during review. → **Mitigation**: tasks.md enumerates every single page explicitly (from Decisions 1–2) as checklist items, not a vague "instrument all pages" task.
- **[Risk]** This change cannot be verified end-to-end (real `POST`/`GET` calls) until the backend change `user-activity-audit-log` is implemented and deployed. → **Mitigation**: built and tested against a mocked `auditLogService.ts` per `frontend-testing.md`; `npm run build`/`npm run test` are sufficient gates for this change alone, full E2E is a joint follow-up once both sides ship.
- **[Risk]** Federation's nested `RequireAuth requiredRoles={["Federation"]}` on `/federation/audit-log` duplicates a small amount of the app-level gate's logic (re-mounting the same 3-second-grace polling loop). → **Mitigation**: accepted — `RequireAuth` is already designed to be composable/nestable (it's a plain component taking `requiredRoles`, no singleton state), and the alternative (loosening the app-level gate or adding a bespoke Federation-only wrapper) is more code for no real benefit.

## Migration Plan

1. Add `shared/services/auditLogService.ts` with typed contracts (Decision 5) — TDD: service tests first (mocked Axios instance).
2. Add `shared/hooks/useAuditPageAccess.ts` (Decision 3) — TDD: hook tests first (fire-once, swallowed error, mocked service).
3. Add `shared/components/ui/AuditLogView/` (Decision 4) — TDD: component tests first (loading/error/empty/data, filters, card layout — no `<table>`).
4. Add `apps/coach/constants/featureRoutes.ts` → `AuditLog` key; add `apps/coach/pages/audit-log/AuditLog.tsx` wrapper + route in `apps/coach/routes.tsx`.
5. Add `apps/federation/pages/AuditLog/AuditLog.tsx` wrapper + route in `apps/federation/routes.tsx` (nested `RequireAuth`).
6. Instrument every auditable page from Decisions 1–2 with `useAuditPageAccess(...)`, grouped into reviewable batches in tasks.md.
7. `npm run build && npm run test` (and Playwright for the two new screens' critical path) before reporting done.
8. Rollback: every change here is additive (new files + one-line hook calls + two new routes); reverting is deleting the new files and the hook-call lines, no data migration involved on the frontend side.

## Open Questions

1. **Exact FeaturePermission seed values** for `COACH_FEATURE_ROUTES.AuditLog` (which of Coach/ClubDirector/Administrator get Read vs ReadWrite, matching the `PagePermission`-style `PermissionType` used for `Roster`) — this is a back-specialist decision, not resolved here; tasks.md records it as an explicit cross-team request, not a silent assumption.
2. **Max `pageSize`** for the Coach/Federation screens' own pagination UI (distinct from the backend's own cap, still TBD per the backend change's own Open Questions) — proposed default: 25 rows per page, matching `GetNews.cs`/`searchAuditLog`'s likely backend default; confirm once the backend's own open question resolves.
