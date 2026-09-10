## Context

Existing building blocks this change reuses (confirmed by reading the actual code, not
assumed):

- **Family members**: `TeamPlayerFamilyMember`
  (`Back/ExtractionApi/src/RFFM.Api/Domain/Entities/TeamPlayers/TeamPlayerFamilyMember.cs`) has
  `Name`, `LastName`, `Phone`, `Email`, `FamilyMember` (relationship label), and a nullable
  `LinkedUserId` set via `LinkAccount(userId)` once the family member's account is approved.
  `GetTeamPlayer.cs` (`Features/Coaches/Players/Queries/GetTeamPlayer.cs`) already computes a
  `RegistrationStatus` of `"Approved"` (has `LinkedUserId`), `"Pending"` (open
  `FamilyMemberAccountRequest`), or `"None"` per family member — this is the exact "has a
  registered account" signal we need, just not exposed for a batch of players across one event.
- **Convocation status**: `Convocation.ConvocationStatusId`
  (`Domain/Aggregates/Assistances/`), backed by the `ConvocationStatus` smart enum
  (`Pending`/`Accepted`/`Justified`/`Deconvoke`). `GetEventConvocations.cs`
  (`Features/Coaches/Convocations/GetEventConvocations.cs`) already returns, per event, every
  convocation with `TeamPlayerId`, `Status` (name), and `StatusId` — the frontend already has
  this loaded when showing the convocation detail screen, so it can determine which players are
  `Pending` and pass their `teamPlayerId`s to the new endpoint without the backend recomputing
  "who is pending" itself.
- **Event context for the WhatsApp message text**: `SportEvent`
  (`Domain/Aggregates/Assistances/SportEvent.cs`) has `Name`, `EveDateTime`, `StartTime`,
  `Location`, `EventTypeId`, `RivalId`/`Rival` — all already available to the frontend on the
  same screen (it renders the event card). No backend change needed to expose event data for the
  message text; only recipient data is missing.
- **Deep link back into the convocation**: `add-news-link`
  (`openspec/changes/archive/2026-09-04-add-news-link/`) already established
  `/coach/attendance/{eventId}?viewConvocation=1` as the role-agnostic (Coach/Player/FamilyMember
  all reachable) destination that auto-opens the read-only convocation dialog. That pattern is
  reused as-is for the WhatsApp message link — no new route, no new dialog.
- **No auto-login/magic-link exists today.** Family members log in with alias+password through
  the standard `SharedLogin` component, which does not currently support a `returnUrl`/redirect
  query param. Making the `wa.me` link actually land the family member on the convocation
  *after* login (not just after they're already authenticated) requires new frontend plumbing
  (`SharedLogin`/`CoachAuthContext` redirect support). That plumbing is **frontend-only** and is
  explicitly out of scope for this change — see Non-Goals and §F0 below (confirmed not resolved
  in this scope, with the concrete reason).
- **Correction to the proposal's premise**: `WhatsAppCredentialsDialog.tsx`
  (`Front/src/apps/coach/pages/player/components/WhatsAppCredentialsDialog.tsx`) and
  `ConvocationDetailsDialog.tsx`'s own "Copiar para WhatsApp" button
  (`Front/src/apps/coach/pages/convocations/components/ConvocationDetailsDialog.tsx`) do **not**
  generate a `wa.me` link — both only copy a pre-built message to the clipboard
  (`navigator.clipboard.writeText`) for the coach to paste manually. A `grep -rn "wa.me"` across
  `Front/src` returns zero matches. There is **no existing `wa.me`-link-opening precedent** in
  this codebase; this change is the first to build and open one. The frontend design below (§F)
  is written fresh, reusing only the *message-composition* style of those two dialogs (plain
  template-literal text builders in a `utils/*.ts` file), not any link-building code that turns
  out not to exist.
- **Where the coach currently acts on pending convocations**: `AttendanceTabs.tsx`
  (`Front/src/apps/coach/pages/attendance/AttendanceTabs.tsx`), not
  `ConvocationDetailsDialog`/`ConvocationMatchDetail` as the proposal's "What Changes" section
  loosely called "the convocation detail screen". `AttendanceTabs.tsx` already renders a
  `CollapsibleGroup title="Pendientes de aceptar"` (~line 563) listing every `ConvocationCard`
  whose status is `Pending`, with a `headerExtra` "Aceptar todos" bulk-action button already
  wired to `canEdit`/Coach-only visibility — this is the natural, already-established place for
  the new selection checkboxes and "Notificar por WhatsApp" bulk action (§F1), not a new screen.

## Goals / Non-Goals

**Goals:**
- Given an `eventId` and a set of `teamPlayerId`s (the players the coach selected, all with a
  pending convocation for that event), return each player's eligible WhatsApp recipients:
  family members with `RegistrationStatus == Approved` **and** a non-empty `Phone`.
- Make it trivial for the frontend to distinguish, per selected player, "has ≥1 recipient" vs.
  "has zero recipients" without a second round trip or client-side filtering logic duplicating
  the registration-status rule.
- Keep the endpoint read-only (`IQueryApp`) — nothing is persisted or "sent" server-side; the
  actual WhatsApp send is the browser opening `wa.me` links, entirely a frontend concern.
- Scope requested players to convocations that actually belong to the given event (defense in
  depth against a stale/tampered `teamPlayerId` list from the client), and to the coach's own
  team (`IRequireTeamMembership`, same guard `GetEventConvocations` already uses).

**Non-Goals:**
- Adding `returnUrl`/redirect-after-login support to `SharedLogin`/`CoachAuthContext` — see §F0
  for the concrete reason this stays out of scope (not just "frontend work", but cross-cutting
  auth-flow work with two separate redirect sites, unrelated to WhatsApp notifications
  specifically). Without it, a family member who isn't already logged in will land on the app's
  default page (`/appSelector`) after login rather than directly on the convocation — accepted
  as a known gap, not resolved in this design (nor in the frontend design below).
- Recomputing "which players are pending" server-side — the frontend already has this from
  `GetEventConvocations` and passes the selected `teamPlayerId`s explicitly.
- Any new entity, migration, or command — this is a pure read/aggregation over existing data.
- Actually marking anything as "notified" / tracking send history — out of scope; can be a
  follow-up if the coach needs to know who was already nudged.

**Frontend Goals** (see §F for the full frontend design):
- Let the coach select one or more `Pending` players from the existing "Pendientes de aceptar"
  group in `AttendanceTabs.tsx` and trigger a bulk "Notificar por WhatsApp" action.
- Fetch eligible recipients from the new endpoint for exactly the selected `teamPlayerId`s, then
  let the coach open one `wa.me` link per family member via an explicit per-recipient click (not
  an auto-loop — browsers block more than one auto-opened `window.open` per user gesture).
- Warn, per selected player, when that player has zero eligible recipients (empty
  `FamilyMembers` from the response) instead of silently skipping them.
- Compose the message text client-side (event type, rival/name, date, time, location, and the
  `/coach/attendance/{eventId}?viewConvocation=1` deep link already established by
  `add-news-link`) — no backend involvement in the message content.

**Frontend Non-Goals:**
- `returnUrl`/redirect-after-login (§F0, restated from the backend Non-Goals above).
- Tracking which family members were actually notified (no send-receipt from `wa.me` — the
  browser opening the link is the only signal available, and it doesn't confirm delivery).
- Any change to `ConvocationDetailsDialog`'s existing "Copiar para WhatsApp" button/flow — that
  stays exactly as it is; the new bulk-notify action is additive, in a different screen.

## Decisions

### 1. New endpoint: `GET /api/events/{eventId}/convocations/notification-recipients`

Sibling vertical-slice file to `GetEventConvocations.cs`:
`Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Convocations/GetConvocationNotificationRecipients.cs`.

```csharp
app.MapGet("/api/events/{eventId}/convocations/notification-recipients",
    async (string eventId, [FromQuery] string[] teamPlayerIds, AppDbContext db,
           IMediator mediator, CancellationToken cancellationToken) => { ... })
   .WithName(nameof(GetConvocationNotificationRecipients))
   .WithTags("Convocations")
   .Produces<ConvocationNotificationRecipientsResponse>();

public record ConvocationNotificationRecipientsQuery : IQueryApp<ConvocationNotificationRecipientsResponse>,
    IRequireFeaturePermission, IRequireTeamMembership
{
    public string EventId { get; init; } = null!;
    public string[] TeamPlayerIds { get; init; } = Array.Empty<string>();
    public string TeamId { get; set; } = null!;
    public string FeatureRoute => CoachFeatureRoutes.Convocations;
    public string RequiredPermission => "Read";
}

public record ConvocationNotificationRecipientsResponse(PlayerRecipients[] Players);

public record PlayerRecipients(
    string TeamPlayerId,
    string PlayerAlias,
    FamilyRecipient[] FamilyMembers); // empty => no eligible recipient for this player

public record FamilyRecipient(
    string FamilyMemberId,
    string? Name,
    string? LastName,
    string Phone,
    string? FamilyMember); // relationship label (e.g. "Padre", "Madre")
```

Query pattern: **GET with a repeated query param** (`?teamPlayerIds=a&teamPlayerIds=b`), not
POST — this is a pure read (`IQueryApp`), matching `GetEventConvocations`'s own GET-based,
no-request-body style, and Minimal API model-binds `string[]` from repeated query keys natively.
A `PagedRequest`-style body isn't warranted; a coach selects at most as many players as fit on
one convocation screen (well under any practical URL-length concern).

**Handler logic:**
1. Resolve `eventId` → `SportEvent` (404-equivalent `DomainException` if missing, same as
   `GetEventConvocations` does today) to get `TeamId` for the `IRequireTeamMembership` guard.
2. Load `Convocations` for that event filtered to `TeamPlayerIds` that are actually convoked to
   this event (`Where(c => c.SportEventId == eventId && teamPlayerIds.Contains(c.TeamPlayerId))`)
   — silently drops any id in the request that isn't a real convocation for this event, rather
   than erroring, since a stale client-side selection (e.g. a convocation removed between page
   load and the notify click) shouldn't block notifying the rest.
3. For each resulting `TeamPlayerId`, load `TeamPlayerFamilyMember`s and compute the same
   `RegistrationStatus` rule `GetTeamPlayer.cs` uses (`LinkedUserId != null` → `Approved`) —
   extracted as a small shared static helper (see Decision 2) rather than re-deriving the
   "approved" boolean inline, so the two endpoints can't drift.
4. Filter to `RegistrationStatus == Approved && !string.IsNullOrWhiteSpace(Phone)`, project to
   `FamilyRecipient[]`.
5. Return one `PlayerRecipients` per requested-and-valid `TeamPlayerId`, in the same order they
   were requested where possible, `FamilyMembers = []` when none qualify — the frontend needs
   this explicit empty array (not an absent player) to reliably show "Jugador X: sin familiar
   registrado" for every selected player it asked about, including ones dropped in step 2 (a
   convocation that no longer exists is functionally "no recipient" too, from the coach's point
   of view — the UI doesn't need to distinguish those two reasons).
6. `AsNoTracking()` throughout (read-only).

### 2. Extract the `RegistrationStatus` computation instead of duplicating it

`GetTeamPlayer.cs`'s inline logic (family member has `LinkedUserId` → `"Approved"`; else has an
open `FamilyMemberAccountRequest` → `"Pending"`; else `"None"`) moves to a small static helper
(e.g. `FamilyMemberRegistrationStatus.Resolve(...)` in
`Features/Coaches/Players/Services/` or a shared `Common/` location — exact placement decided at
implementation time by inspecting `GetTeamPlayer.cs`'s current query shape) that both
`GetTeamPlayer.cs` and the new endpoint call. Alternative considered: duplicate the two-line
condition in the new handler. Rejected — the new endpoint only cares about the `Approved` case,
but a future third consumer needing `Pending`/`None` too would otherwise face three copies of
the same rule; extracting now costs one small helper and one call-site update to
`GetTeamPlayer.cs`, and keeps `GetTeamPlayer.cs`'s own tests as the regression guard for the
extraction (verified by running its existing tests unchanged).

### 3. Authorization mirrors `GetEventConvocations`

`IRequireFeaturePermission` (`CoachFeatureRoutes.Convocations`, `"Read"`) +
`IRequireTeamMembership` — the same two guards `GetEventConvocations.cs` already applies, so
only a coach/administrator with read access to that team's convocations can pull family phone
numbers. Family/Player roles have no reason to call this endpoint (they don't notify anyone) and
are not granted access.

## Frontend Design

### F0. `returnUrl` after login — confirmed out of scope, with the concrete reason

Traced the actual login flow to decide this properly rather than repeating the proposal's
assumption:

- `SharedLogin` (`Front/src/shared/components/ui/Login/Login.tsx`) already accepts a
  `redirectTo?: string` prop and calls `navigate(redirectTo ?? "/appSelector", { replace: true })`
  on success — so *one* of the two redirect sites already supports a caller-supplied target.
- But `CoachAuthContext.login()` (`Front/src/apps/coach/context/CoachAuthContext.tsx`, line
  ~152) unconditionally does `window.location.href = "/appSelector"` a few hundred ms after a
  successful login, **regardless of what `SharedLogin` just navigated to** — a full-page
  redirect that would clobber any `redirectTo` a query-param-driven `returnUrl` might set. Both
  sites would need to change together, and `CoachAuthContext` is shared by every login on every
  role (Coach, Player, FamilyMember, Federation), not something owned by this feature.
- Making the `wa.me` deep link truly land a logged-out family member on the convocation would
  therefore require: (1) `CoachLoginWrapper`/`SharedLogin` reading a `returnUrl` query param, (2)
  threading it through to `CoachAuthContext.login()`, and (3) fixing the redirect race between
  `SharedLogin`'s `navigate()` and `CoachAuthContext`'s hardcoded `window.location.href`. That's
  a cross-cutting auth-flow change affecting every login in the app, unrelated in blast radius to
  "notify pending confirmations via WhatsApp" — it deserves its own change (and its own
  regression testing of every login path), not to ride along inside this one.
- **Decision: not resolved in this change.** A family member who is already logged in when they
  tap the `wa.me` link's deep link gets taken straight to the convocation (`AttendanceEvent`
  handles `?viewConvocation=1` today, per `add-news-link`). A family member who is logged out
  lands on `/login`, then `/appSelector` after authenticating, and has to navigate to the event
  manually. This is an accepted, explicitly-flagged product gap — not a silent omission — and is
  listed as a candidate follow-up in Risks below.

### F1. Selection UI: `AttendanceTabs.tsx`'s existing "Pendientes de aceptar" group

No new screen. `ConvocationCard.tsx` gains three new optional props:
```ts
selectable?: boolean;       // only ever true for cards rendered inside the pending group
selected?: boolean;
onToggleSelect?: (teamPlayerId: string) => void;
```
When `selectable` is true, the card renders a `Checkbox` (top-left of `cromoPhotoArea`, styled
consistently with the existing `cromoDorsalBadge` corner-badge positioning) wired to
`onToggleSelect`. Undefined/false (every other call site) renders nothing new — fully backward
compatible with `ConvocationCard`'s other four call sites (`renderDeconvokedCard`,
`renderInjuredCard`'s inline JSX, `renderCard`, and the three `__tests__` files exercising it).

`AttendanceTabs.tsx` gains:
```ts
const [selectedPendingIds, setSelectedPendingIds] = useState<Set<string>>(new Set());
```
reset to empty whenever `eventId` changes (existing `useEffect` that reloads `convocations` on
`eventId` change gains one line) or after a successful notify-dialog close. The "Pendientes de
aceptar" `CollapsibleGroup`'s `headerExtra` gains, alongside the existing "Aceptar todos"
button, a `Checkbox` "Seleccionar todos" (indeterminate when some-but-not-all pending are
selected) and a `Button` "Notificar por WhatsApp" (`startIcon={<WhatsAppIcon />}`, matching the
`#25D366` WhatsApp-green outline styling `ConvocationDetailsDialog` already uses for its own
WhatsApp button) — visible under the same `!isPlayerOrFamily && canEdit` gate as "Aceptar
todos", disabled while `selectedPendingIds.size === 0`. Clicking it opens the new
`NotifyPendingConvocationDialog` (§F2) with `teamPlayerIds={[...selectedPendingIds]}`.

Rejected alternative: a floating/sticky action bar detached from the group header. The existing
"Aceptar todos" pattern already establishes headerExtra as where pending-group bulk actions
live; a second, differently-placed bulk-action affordance for a closely related action (both act
on the same "Pendientes de aceptar" set) would be inconsistent for no benefit.

### F2. `NotifyPendingConvocationDialog.tsx` — new component

`Front/src/apps/coach/pages/attendance/components/NotifyPendingConvocationDialog.tsx` (sibling
to `ConvocationCard.tsx`, `DeconvokeDialog.tsx`, `CollapsibleGroup.tsx` in the same
`components/` folder — same convention as the rest of that page's dialogs).

```ts
type Props = {
  open: boolean;
  onClose: () => void;
  eventId: string;
  teamPlayerIds: string[];       // the coach's current selection
  eventSummary: PendingConfirmationEventSummary;  // §F3 — for the message text
};
```

On `open`, fetches recipients via the new service (§F4) into local state
(`loading | error | PlayerRecipients[]`). Renders, per requested player (in request order, per
Decision 1 step 5):
- A row with the player's alias/name.
- If `familyMembers.length === 0`: a muted warning row — "Sin familiar con cuenta registrada y
  teléfono" (no button, nothing to click).
- Else: one `Button` per family member (`"{FamilyMember label}: {Name}"`, e.g. "Madre: María
  López"), `startIcon={<WhatsAppIcon />}`, `target="_blank"` semantics via `window.open(waLink,
  "_blank", "noopener,noreferrer")` on click — **not** auto-opened on dialog mount/fetch
  completion, since browsers block more than one popup per user gesture; each family member's
  link opens only from its own explicit click. Clicked buttons flip to a `CheckIcon` "Abierto"
  state (local `Set<familyMemberId>`, reset each time the dialog re-opens) purely as a visual
  "already opened this one" marker — not a send receipt (§ Frontend Non-Goals).

A dialog-level summary line at the top: "N de M jugadores seleccionados tienen un familiar al
que notificar" when at least one selected player has zero recipients, so the coach sees the gap
before scrolling the per-player list (this is the "warns listing players with no eligible
recipient" behavior the proposal calls for).

Loading/error states follow the same `CircularProgress`/inline error-text pattern
`ConvocationDetailsDialog` and `AttendanceTabs` already use elsewhere on this page — no new UI
primitive.

### F3. Message text: new util, not reusing `convocationSummary.ts`

`convocationSummary.ts`'s `buildWhatsAppText` builds a full convocados/desconvocados roster
summary for the coach to paste into a team group chat — a different purpose (and a different
audience: it's coach-facing broadcast text, not a personalized "please confirm" nudge to one
family). Reusing it would mean stripping out everything roster-related; a small dedicated util
is clearer:

`Front/src/apps/coach/pages/attendance/utils/pendingConfirmationWhatsApp.ts`:
```ts
export type PendingConfirmationEventSummary = {
  eventTypeLabel: string;   // "Partido" | "Entrenamiento" | "Amistoso" | "Torneo" — coach-facing label already computed by AttendanceEvent
  rivalName: string | null;
  dateES: string;           // already-formatted date, reusing the same formatting AttendanceEvent/ConvocationDetailsDialog use (date-fns, existing pattern)
  time: string | null;
  location: string | null;
};

export function buildPendingConfirmationMessage(
  summary: PendingConfirmationEventSummary,
  playerAlias: string,
  deepLinkUrl: string
): string {
  const lines = [
    `Hola! Recordatorio de convocatoria para ${playerAlias}.`,
    `${summary.eventTypeLabel}${summary.rivalName ? ` vs ${summary.rivalName}` : ""}`,
    `${summary.dateES}${summary.time ? ` · ${summary.time}` : ""}`,
  ];
  if (summary.location) lines.push(summary.location);
  lines.push("", `Confirma tu asistencia aquí: ${deepLinkUrl}`);
  return lines.join("\n");
}

export function buildWaMeLink(phone: string, message: string): string {
  const digits = phone.replace(/[^\d]/g, "");          // strip spaces/dashes/parens/+ — wa.me needs digits-only, country code included
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
```
`deepLinkUrl` is built by the dialog as ``${window.location.origin}/coach/attendance/${eventId}?viewConvocation=1``
— the exact route `add-news-link` established, reused verbatim (no new route).

Phone normalization is intentionally minimal (strip everything but digits) — same "accepted, no
format validation" stance the backend design already takes for `TeamPlayerFamilyMember.Phone`
(free text). A family member whose phone was stored without a country code produces a `wa.me`
link that WhatsApp itself will reject/misinterpret; that's a pre-existing data-quality issue
this feature doesn't attempt to fix (same as `WhatsAppCredentialsDialog` never has).

### F4. New service — `convocationNotificationService.ts`

`Front/src/apps/coach/services/convocationNotificationService.ts`:
```ts
export type FamilyRecipient = {
  familyMemberId: string;
  name: string | null;
  lastName: string | null;
  phone: string;
  familyMember: string | null;   // relationship label
};

export type PlayerRecipients = {
  teamPlayerId: string;
  playerAlias: string;
  familyMembers: FamilyRecipient[];
};

export async function getConvocationNotificationRecipients(
  eventId: string,
  teamPlayerIds: string[]
): Promise<PlayerRecipients[]> {
  const qs = new URLSearchParams();
  teamPlayerIds.forEach((id) => qs.append("teamPlayerIds", id));
  const resp = await client.get<{ players: PlayerRecipients[] }>(
    `/api/events/${eventId}/convocations/notification-recipients?${qs.toString()}`
  );
  return resp.data?.players ?? [];
}

export default { getConvocationNotificationRecipients };
```
Query string built manually with `URLSearchParams.append` (repeated `teamPlayerIds=a&teamPlayerIds=b`)
instead of passing `params: { teamPlayerIds }` to axios — sidesteps any ambiguity in how the
shared `client.ts` instance's axios version would otherwise serialize an array param (bracket
vs. repeat notation); ASP.NET Core Minimal API's `[FromQuery] string[] teamPlayerIds` binds only
the repeated-key form, so this is built explicitly rather than trusted to a library default. Same
single-Axios-instance rule as every other service (`import client from "../../../core/api/client"`).

### F5. Wiring `AttendanceEvent.tsx` → `AttendanceTabs.tsx`

`AttendanceTabs`'s `Props` gains one new optional field:
```ts
eventSummary?: PendingConfirmationEventSummary;   // from §F3 — undefined only in the handful of existing tests that don't pass it
```
`AttendanceEvent.tsx` already holds `event: SportEventResponse` with `name`, `rivalName`,
`location`, `startTime`/`eveDateTime` — everything `PendingConfirmationEventSummary` needs — so
it's derived once in `AttendanceEvent.tsx` (same file that already formats these fields for its
own header, lines ~274-362) and passed down, rather than `AttendanceTabs` re-fetching or
re-deriving event data it doesn't otherwise need. `NotifyPendingConvocationDialog` receives
`eventSummary` from `AttendanceTabs` unchanged.

## Risks / Trade-offs

- [No `returnUrl` support in `SharedLogin`/`CoachAuthContext`] → Confirmed out of scope, reason
  traced in §F0 (two separate redirect sites, cross-cutting to every login path in the app). The
  `wa.me` deep link still works today (lands an already-logged-in family member on the
  convocation; a logged-out one lands on `/login` then `/appSelector` after authenticating) but
  doesn't auto-redirect post-login. Tracked as a candidate follow-up change, not silently
  dropped, and not bundled here given its unrelated blast radius.
- [Silently dropping stale `teamPlayerId`s (step 2) instead of erroring] → Accepted; a coach
  retrying a notify action after a convocation changed shouldn't get a hard failure for the
  whole batch over one stale id. The response's per-player `FamilyMembers: []` already gives the
  frontend everything it needs to flag that player to the coach.
- [Phone number format not validated/normalized here] → Accepted; `TeamPlayerFamilyMember.Phone`
  is stored as free text today (same as it already is for `WhatsAppCredentialsDialog`'s flow) —
  the frontend's `buildWaMeLink` (§F3) does a minimal digits-only strip, the same "no real
  validation" stance the backend takes, consistent with how the existing credentials dialog
  already handles it (it doesn't normalize either).
- [No "already notified" tracking] → Accepted (Frontend Non-Goals); the "Abierto" per-button
  state in `NotifyPendingConvocationDialog` (§F2) is local, resets every time the dialog
  re-opens, and is a UX nicety within one dialog session, not a persisted send record. A coach
  reopening the dialog for the same players later sees a fresh, unmarked list.
- [`ConvocationCard`'s new `selectable`/`selected`/`onToggleSelect` props touch a component with
  4 existing call sites and 1 dedicated test file] → Accepted; all three new props are optional
  and default to inert (no checkbox rendered) when omitted, so the three non-pending call sites
  (`renderDeconvokedCard`, `renderInjuredCard`, and `accepted`/`desconvocados` uses of
  `renderCard`) and their existing tests (`ConvocationCard.test.tsx`,
  `AttendanceTabsDesconvocadosReactivation.test.tsx`, etc.) need no changes — verified by reading
  every `<ConvocationCard` call site before deciding this was additive-safe.

## Open Questions

None. Backend: endpoint contract, authorization, and data-shaping rules are fully resolved
above. Frontend: component boundaries (§F1–F5), message/link construction, and the returnUrl
scope decision (§F0) are all resolved — this design is ready to move into TDD implementation
(back-specialist for §1–3, front-specialist for §F1–F5, in either order since the frontend
service layer only needs the documented contract, not a running backend, to write its tests
against a mocked `client`).
