## Context

`SportEvent` (`Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/Assistances/SportEvent.cs`) is the
single entity behind every calendar entry for a team — training, meetings, access trials, league
matches, friendlies, and tournaments — distinguished only by `EventTypeId`, a plain `int` FK to the
closed lookup list in `SportEventType.cs`:

```
Match = 1 ("Partido"), Training = 2, Meeting = 3, FriendlyMatch = 4 ("Amistoso"),
AccessTrials = 5, Tournament = 6 ("Torneo")
```

`Tournament` (id 6) was added recently via migration `20260828112649_AddTournamentSportEventType`
and is already seeded in `app.SportEventTypes` — the domain and DB fully support all three match
variants today. No new entity or migration is needed.

Two existing pieces read/write this data for the Coach app's calendar:

- **`GET /api/sport-events/{teamId}`** (`GetSportEvents.cs`) — paginated read, already returns
  `EventTypeId` per event, plus rival/team/goals/kit metadata. The Coach SPA
  (`useConvocations.ts:80`) currently filters client-side to `eventTypeId === 1`, and Mobile
  (`isFriendlyEventType`/`isTournamentEventType` in the archived
  `mobile-friendlies-tournaments-tab` change) resorts to matching the *localized type name*
  (`'amistoso'`, `'torneo'`/`'competici'` substrings) because the response carries no stable,
  non-localized category. That substring approach is fragile (breaks if `SportEventType.Name` is
  ever re-worded) and duplicated per client.
- **`POST /api/sport-events/sync-calendar`** (`SyncCalendarFromFederation.cs`) — bulk
  upsert of league matches pulled from the RFFM Federation calendar API. Its idempotency rule:
  match an existing `SportEvent` first by `CodActa` (federation's own match id) when present,
  otherwise by `TeamId` + same-day `EveDateTime` window, **filtered to
  `EventTypeId == SportEventsConstants.MatchEventTypeId` (1)**. This endpoint has no concept of
  friendlies/tournaments today — there is no bulk/idempotent entry path for them at all, only the
  one-at-a-time generic `POST /api/sport-events` (`CreateSportEvent.cs`), which does not upsert
  (every call creates a new row).

## Goals / Non-Goals

**Goals:**
- Give every calendar-event API response a stable, backend-owned way to say "this is a
  league / friendly / tournament match" without string matching on a localized name.
- Let calendar regeneration upsert friendly and tournament events idempotently — calling it twice
  with the same input must not duplicate rows — mirroring the existing league behavior exactly.
- Keep the existing `/sync-calendar` endpoint and its `Matches` (league) behavior byte-for-byte
  backward compatible.

**Non-Goals:**
- No change to `SportEventType`'s fixed id list or seed data (already correct).
- No new source of truth for friendly/tournament fixtures — that's a manual bulk-entry UI the
  frontend will build later; this change only prepares the backend upsert endpoint it will call.
- No change to `GetEventConvocations`, `AddConvocations`, or any convocation/attendance feature —
  those already operate on any `SportEvent` regardless of `EventTypeId`.
- Frontend consumption (removing the `eventTypeId === 1` filter, wiring a friendlies/tournaments
  bulk-entry form) is explicitly out of scope for this backend-only change.

## Decisions

### 1. Add `MatchCategory` to `SportEventResponse` instead of a generic `EventTypeName`

`SportEventResponse` (`GetSportEvents.cs`) gains one new nullable string field:

```csharp
public string? MatchCategory { get; set; } // "League" | "Friendly" | "Tournament" | null
```

Computed server-side from `EventTypeId`:
- `1` (Match) → `"League"`
- `4` (FriendlyMatch) → `"Friendly"`
- `6` (Tournament) → `"Tournament"`
- anything else (Training, Meeting, AccessTrials, future types) → `null`

Rejected alternative: exposing `EventTypeName` (the existing localized `SportEventType.Name`,
e.g. `"Amistoso"`) alone. That's already obtainable via `GET /api/sport-event-types` and is
exactly the string clients are currently forced to substring-match — it doesn't solve the
fragility, only relocates it. `MatchCategory` is a stable English enum-like value, independent of
localization, and directly answers "is this a match, and which kind" — the frontend still fetches
`GET /api/sport-event-types` separately for the human-readable label to display.

Rejected alternative: a `bool IsMatch` flag. Loses the League/Friendly/Tournament distinction the
proposal explicitly asks for (frontend needs to style/label them differently), so a tri-state
category is required, not a boolean.

### 2. Generalize `/api/sport-events/sync-calendar` with additive optional arrays, not a new endpoint

`SyncCalendarRequest` gains two new optional arrays, reusing the existing `SyncMatchItem` shape
(no new DTO needed — a friendly/tournament fixture has exactly the same fields as a league one:
rival, date/time, field, home/away, optional acta/goals):

```csharp
public record SyncCalendarRequest(
    string TeamId,
    SyncMatchItem[] Matches,              // existing — league, EventTypeId=1
    string? MyTeamShieldUrl,
    SyncMatchItem[]? Friendlies = null,   // new — EventTypeId=4
    SyncMatchItem[]? Tournaments = null   // new — EventTypeId=6
);
```

The handler's per-match loop (rival resolution → shield download → find-or-create `SportEvent`)
is extracted into a private method parameterized by `(SyncMatchItem[] items, int eventTypeId)` and
invoked three times — once per array — accumulating into the same `created`/`updated`/`failed`
counters and `savedEvents` list already returned by `SyncCalendarResponse`. The existing
fallback-match query's hardcoded `e.EventTypeId == SportEventsConstants.MatchEventTypeId` becomes
`e.EventTypeId == eventTypeId`, so each array's idempotency is scoped to its own type — a friendly
and a league match on the same date for the same team never collide with each other.

Rejected alternative: a brand-new endpoint (e.g. `POST /api/sport-events/sync-friendlies`). Would
duplicate the entire rival-resolution/shield-download/idempotent-upsert block a second time for no
benefit — the two use cases share 100% of their logic and differ only in which `EventTypeId` they
target and which request array they read from. A single generalized endpoint keeps the vertical
slice as one file, per convention.

`Matches` stays required and first, so every existing frontend caller (`syncCalendarFromFederation`
in `Front/src/apps/coach/services/sportEventService.ts`) keeps working unchanged; `Friendlies` and
`Tournaments` default to `null`/empty and are simply skipped when absent.

### 3. Response contract for frontend consumption (stable, for the follow-up FE change)

**`GET /api/sport-events/{teamId}`** — unchanged shape plus one field:
```jsonc
{
  "id": "…", "name": "vs Rival FC", "eveDateTime": "2026-09-05T17:00:00Z",
  "eventTypeId": 4,
  "matchCategory": "Friendly",   // NEW — "League" | "Friendly" | "Tournament" | null
  "rivalId": "…", "rivalName": "Rival FC", "isHomeMatch": true,
  "localGoals": null, "visitorGoals": null,
  "hasConvokedPlayers": false
  // …all other existing fields unchanged
}
```

**`POST /api/sport-events/sync-calendar`** — request:
```jsonc
{
  "teamId": "…",
  "matches": [ { "rivalName": "…", "matchDate": "…", "matchTime": "17:00", "field": "…",
                 "isHomeMatch": true, "codActa": "…", "localGoals": null, "visitorGoals": null } ],
  "myTeamShieldUrl": null,
  "friendlies": [ /* same item shape, EventTypeId=4 */ ],
  "tournaments": [ /* same item shape, EventTypeId=6 */ ]
}
```
— response unchanged: `{ created, updated, failed, events: SportEventSaveResponse[] }`, where each
`SportEventSaveResponse.EventTypeId` tells the caller which array produced it (1/4/6).

## Risks / Trade-offs

- **[Risk]** Idempotency for friendlies/tournaments has no `CodActa` in practice (that field is a
  Federation-specific match id and friendlies/tournaments aren't Federation fixtures) → falls back
  to the `TeamId + EventTypeId + same-day EveDateTime` window, same as league matches without an
  acta today. Two friendlies against different rivals on the same calendar day for the same team
  would collide and the second upsert would overwrite the first. → Mitigation: documented as a
  known limitation matching the pre-existing league behavior (not a regression); an acceptable
  trade-off given no caller of this endpoint yet exists for friendlies/tournaments, and the
  fallback is unchanged in kind from what league sync already does.
- **[Trade-off]** Reusing `SyncMatchItem`'s field names (`RivalName`, `MatchDate`, `CodActa`, …)
  for friendlies/tournaments even though "match" isn't quite the right noun for a tournament
  fixture → accepted to avoid a parallel DTO with identical shape; the wire field names are
  slightly generic but unambiguous in context (`friendlies: SyncMatchItem[]`).

## Open Questions

None blocking implementation. Naming/copy for any frontend UI built on top of `matchCategory` is
left to the follow-up frontend change.

## Frontend Follow-up (implemented in this same change, see tasks.md §4)

Rather than a separate change, the frontend consumption described as out-of-scope above was
implemented directly in this change's task list once the backend contract stabilized:

- `Front/src/apps/coach/services/sportEventService.ts` now types `matchCategory` on
  `SportEventResponse` and `friendlies`/`tournaments` on `SyncCalendarPayload`.
- `Front/src/apps/coach/pages/convocations/hooks/useConvocations.ts` includes any event whose
  `matchCategory` is non-null in the calendar's `matches` list (previously hardcoded to
  `eventTypeId === 1`), with a fallback to the old heuristic for backward compatibility.
- `Front/src/apps/coach/pages/convocations/components/MatchCard.tsx` renders a small category
  chip ("Liga"/"Amistoso"/"Torneo") using existing Coach theme tokens — no new colors.
- Visibility for Player/Family/Follower is unchanged structurally: `Convocations.tsx` already
  renders the same match list to every role (only the sync button is role-gated), so friendlies
  and tournaments are visible to all roles once included in `matches`.
- No bulk-entry UI for friendlies/tournaments exists yet (per this design's own non-goal), so
  `handleSyncCalendar` still only sends the Federation-sourced `matches` array; the new
  `friendlies`/`tournaments` payload fields are typed and ready for that future form.
