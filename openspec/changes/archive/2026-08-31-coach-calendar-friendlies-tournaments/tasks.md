## 1. MatchCategory on GetSportEvents

- [x] 1.1 (RED) Add xUnit tests to `GetSportEventsHandlerTests.cs` (or a new
      `GetSportEventsMatchCategoryTests.cs`) asserting `MatchCategory` is `"League"` for
      `EventTypeId=1`, `"Friendly"` for `4`, `"Tournament"` for `6`, and `null` for `2`/`3`/`5`.
      Confirm they fail against current code.
- [x] 1.2 (GREEN) Add `MatchCategory` to `SportEventResponse` and compute it in the handler's
      `Select` projection in `Features/Coaches/SportEvents/Queries/GetSportEvents.cs`.
- [x] 1.3 Run the new tests and confirm green; run the full `GetSportEventsHandlerTests` suite to
      confirm no regression.

## 2. Generalize sync-calendar for Friendlies and Tournaments

- [x] 2.1 (RED) Add a new test file `SyncCalendarFromFederationTests.cs` under
      `tests/RFFM.Api.Tests/IntegrationTests/` (or `UnitTests/`, matching the nearest sibling
      pattern) covering, against the real Postgres test fixture:
      - existing `Matches`-only behavior is unchanged (create then update by `CodActa`, and by
        team+date fallback when `CodActa` is absent)
      - a `Friendlies` item creates a `SportEvent` with `EventTypeId=4`
      - calling sync twice with the same `Friendlies` item updates the same row (no duplicate)
      - a `Tournaments` item creates a `SportEvent` with `EventTypeId=6`
      - calling sync twice with the same `Tournaments` item updates the same row (no duplicate)
      - a league match and a friendly on the same team/date do not collide with each other
      Confirm all new assertions fail against current code.
- [x] 2.2 (GREEN) In `Features/Coaches/SportEvents/Commands/SyncCalendarFromFederation.cs`:
      - Add `Friendlies` and `Tournaments` optional arrays (default `null`) to
        `SyncCalendarRequest`, reusing `SyncMatchItem`.
      - Extract the per-item rival-resolve + find-or-create block into a private method
        parameterized by `(AppDbContext, IStorageService, string teamId, SyncMatchItem[] items,
        int eventTypeId, Dictionary<string, Rival> rivalsByName, List<Rival> allRivals,
        counters, savedEvents, CancellationToken)` (signature per existing method style).
      - Replace the hardcoded `SportEventsConstants.MatchEventTypeId` in the fallback lookup query
        with the loop's `eventTypeId` parameter.
      - Call the extracted method three times: once for `Matches` (eventTypeId=1, unchanged
        behavior), once for `Friendlies` (eventTypeId=4) when non-null/non-empty, once for
        `Tournaments` (eventTypeId=6) when non-null/non-empty — accumulating into the same
        `created`/`updated`/`failed`/`savedEvents`.
- [x] 2.3 Run the new tests and confirm green; run existing sync-calendar-adjacent tests
      (`CreateSportEventInlineRivalTests`, `SportEventsPushNotificationWiringTests`) to confirm no
      regression.

## 3. Verification

- [x] 3.1 `dotnet build` from `Back/ExtractionApi` — must pass with no new warnings introduced.
- [x] 3.2 `dotnet test` — full suite green, no skipped tests.
- [x] 3.3 `openspec validate coach-calendar-friendlies-tournaments --strict` — passes.

## 4. Frontend consumption (front-specialist, `Front/`)

- [x] 4.1 (RED) Add `MatchCard.matchCategory.test.tsx` asserting the Coach calendar's `MatchCard`
      renders a distinct label/chip ("Liga"/"Amistoso"/"Torneo") per `matchCategory`, uses a
      different CSS class per category, and renders nothing when `matchCategory` is `null`.
      Confirm it fails against current code.
- [x] 4.2 (RED) Add `useConvocations.matchCategory.test.tsx` asserting `useConvocations` includes
      League/Friendly/Tournament events (identified by the backend's `matchCategory` field) in
      `matches`, excludes non-match events (`matchCategory: null`), and propagates `matchCategory`
      onto each `NormalizedMatch`. Confirm it fails against current code.
- [x] 4.3 (GREEN)
      - `Front/src/apps/coach/services/sportEventService.ts`: add `MatchCategory` type and
        `matchCategory` field to `SportEventResponse`; add optional `friendlies`/`tournaments`
        arrays to `SyncCalendarPayload` (same `SyncMatchItem` shape as `matches`).
      - `Front/src/apps/coach/pages/convocations/types.ts`: add `MatchCategory` type and
        `matchCategory` field to `NormalizedMatch`.
      - `Front/src/apps/coach/pages/convocations/helpers/convocationUtils.ts`: propagate
        `ev.matchCategory` in `normalizeFromSportEvent`.
      - `Front/src/apps/coach/pages/convocations/hooks/useConvocations.ts`: extend the match
        filter to include any event with a non-null `matchCategory` (falls back to the legacy
        `eventTypeId === 1`/name-substring heuristic for older responses).
      - `Front/src/apps/coach/pages/convocations/components/MatchCard.tsx` +
        `MatchCard.module.css`: render a small category chip (icon + label) per
        League/Friendly/Tournament, styled with the existing Coach theme tokens
        (`--rffm-primary`, `--rffm-secondary`) plus the app's existing amber accent — no new
        colors introduced.
- [x] 4.4 Run `npm run test` (full suite) and `npm run build` from `Front/` — confirm green with
      no regressions (two pre-existing unrelated failures: a Playwright spec picked up by the
      Vitest config, and an unrelated `SeasonPlanEditor` timeout — both present before this
      change).
- [x] 4.5 Visibility for Player/Family/Follower roles: confirmed `Convocations.tsx` already
      renders the same `matches` list (calendar grid + mobile agenda) to every role — only the
      "Generar calendario" sync button is gated by role — so friendlies/tournaments become
      visible to Coach, Player, Family and Follower automatically once included in `matches`; no
      additional role-based branching was needed.
- [ ] 4.6 (Out of scope, per backend design's explicit non-goal) No manual bulk-entry UI exists
      yet for friendlies/tournaments fixtures, so `handleSyncCalendar` continues to send only the
      Federation-sourced `matches` array. `SyncCalendarPayload.friendlies`/`.tournaments` are
      wired and ready for a future bulk-entry form to populate.
