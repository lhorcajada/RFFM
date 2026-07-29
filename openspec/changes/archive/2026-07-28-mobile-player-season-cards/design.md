## Context

**Facts gathered from the codebase** (not assumptions):

- `MatchParticipation` (`Domain/Entities/TeamPlayers/MatchParticipation.cs`): `EventId, TeamId, TeamPlayerId, MinutesPlayed, IsStarter, EnteredAtMinute, ExitedAtMinute, SubstitutionWindowsJson, RatingSnapshotsJson, GoalsJson, ScoreLocal, ScoreVisitor, MatchPhase ("finished" by default), CreatedAt, UpdatedAt`. One row per player per `SportEvent`, upserted by `SaveMatchParticipation.cs` (Coach web, `POST /api/events/{eventId}/match-participation`, `[Authorize(Roles = "Coach,Administrator")]`). **No cards field exists.**
- `GoalsJson` is a JSON array of `GoalEvent`-shaped objects (`scorerId`, `isOwnTeam`), parsed ad hoc with `JsonDocument` in `GetSeasonPlayerStats.CountGoalsForPlayer` (`Features/Coaches/Players/Queries/GetSeasonPlayerStats.cs:93-120`) — no dedicated C# type, just JSON property lookups. `GetSeasonPlayerStats` itself only filters `MatchPhase == "finished"` and groups by `TeamPlayerId`; it does **not** join `SportEvent`, so today "a match" for stats purposes is whatever the coach saved via `SaveMatchParticipation`, regardless of the underlying `SportEventType` (official league match vs. friendly).
- `SportEventType` (`Domain/Aggregates/Assistances/SportEventType.cs`): `Match=1 ("Partido")`, `Training=2 ("Entrenamiento")`, `Meeting=3`, `FriendlyMatch=4 ("Amistoso")`, `AccessTrials=5`.
- `Convocation` (`Domain/Aggregates/Assistances/Convocation.cs`): `SportEventId, TeamPlayerId, AssistanceTypeId, ResponseDateTime, ConvocationStatusId, ExcuseTypeId`. Not scoped to event type — `SportEvent.EventTypeId` is what distinguishes a match convocation from a training convocation.
- `ConvocationStatus` (`Domain/Aggregates/Assistances/ConvocationStatus.cs`): `Pending=1, Accepted=2, Justified=4, Deconvoke=5` (no id 3 — historical gap, not our concern).
- `SportEvent` (`Domain/Aggregates/Assistances/SportEvent.cs`) has **no `SeasonId` FK** — already noted as a known gap in `GetTrainingAttendanceSummary.cs:81-83` ("SportEvent currently has no SeasonId FK in schema... Season filtering can be applied here once SportEvent.SeasonId exists"). `TeamPlayer.SeasonId` exists, but a `Team` row is effectively the season boundary used by every existing season-stats endpoint (`GetSeasonPlayerStats` takes only `TeamId`, no `seasonId`).
- `CoachFeatureRoutes` (`Domain/Entities/CoachFeatureRoutes.cs`): existing `AttendanceConfirmation = "/mobile/attendance"` is the only `/mobile/*`-prefixed route today; permission seed rows live in `WebApplicationExtensions.cs` as `(featureName, featureRoute, roleName, permTypeId, isEditable)` tuples, `permTypeId` 1=Read, 3=ReadWrite.
- `TeamPlayer` (`Domain/Entities/TeamPlayers/TeamPlayer.cs`) has `Dorsal` (value object); `Player` (`Domain/Entities/Players/Player.cs`) has `Alias`, `UrlPhoto`.
- Mobile precedent `GET /api/mobile/events/{eventId}/attendance-roster` (`Mobile/Attendance/Queries/GetEventAttendanceRoster.cs`) already resolves photo via `Mobile/src/utils/resolvePhotoUrl.ts` client-side (handles relative local-storage paths) — the new screen reuses this, no new backend photo-serving work needed.
- `RootNavigator.tsx`'s `CalendarTabs` is a `Tab.Navigator` with `CalendarTab` and `NewsTab` today (`Mobile/src/navigation/RootNavigator.tsx:31-60`).

## Goals / Non-Goals

**Goals:**
- One read-only backend endpoint returning everything the Mobile cromo screen needs, in one round trip.
- Persist card data using the same low-overhead pattern already used for goals (`*Json` blob on `MatchParticipation`), so it doesn't require a new table or relationship.
- Define "jornada actual" and "partidos desde la última desconvocatoria" precisely enough to implement deterministically, given neither concept exists in the domain today.

**Non-Goals:**
- No Coach web (`Front/`) UI to *capture* cards in this change. `SaveMatchParticipation.cs` accepts `CardsJson` if a caller supplies it, but no existing caller does yet — card counts read as `0` until a future change adds capture UI.
- No `SportEvent.SeasonId` migration — out of scope; this change follows the existing convention of using `TeamId` as the season boundary, same as `GetSeasonPlayerStats`.
- No changes to `GetSeasonPlayerStats`, `GetPlayerMatchHistory`, or `GetTrainingAttendanceSummary` — the new endpoint is additive and self-contained; it queries the same tables directly rather than calling those handlers, so it can apply consistent match-type filtering (see Decision 3) without touching existing behavior.

## Decisions

1. **Add `CardsJson` to `MatchParticipation`**, mirroring `GoalsJson` exactly: nullable `string`, JSON array of `CardEvent(TeamPlayerId, CardType)` where `CardType` is the literal string `"Yellow"` or `"Red"` (no dedicated C# type — parsed with `JsonDocument`, same as `CountGoalsForPlayer`). Requires an EF Core migration (`.\manage-migrations.ps1`) and a new nullable column in `MatchParticipationEntityConfiguration.cs`.
   - *Alternative considered*: a new `MatchCard` child table (one row per card, with minute). Rejected — no existing feature needs per-card minute/detail (unlike `Absences[]` in training summary), and the JSON-blob pattern is the established precedent for match-event data on this entity (`GoalsJson`, `SubstitutionWindowsJson`, `RatingSnapshotsJson`).

2. **Extend `SaveMatchParticipation.cs`** (`Request` and `Handler.Update`/`.Create`) to accept and persist an optional `CardsJson` on the top-level request, matching how `GoalsJson` is already accepted top-level (not per-`PlayerParticipationDto`) and stored identically on every player's row for that match — same shape as goals today. No route change, no new authorization rule (already `Coach,Administrator`).

3. **New endpoint defines "a match" consistently as `SportEvent.EventTypeId == SportEventType.Match.Id` ("Partido")**, joining `MatchParticipation` to `SportEvents` on `EventId` and filtering `EventTypeId == 1` for every count in the new DTO (`MatchesPlayed`, `MatchesStarted`, `Goals`, `CurrentMatchday`, `MatchesSinceLastDeconvocation`). Friendlies (`Amistoso`) and other event types are excluded.
   - *Alternative considered*: reuse `GetSeasonPlayerStats`'s definition (any `MatchPhase == "finished"` row, no event-type filter, so friendlies count too). Rejected — "jornada" is a league-match concept; mixing friendlies into the matchday count would make the number meaningless, and the user explicitly chose "solo partidos" for the deconvocation count, so the whole card uses one consistent match definition rather than mixing two.

4. **"Jornada actual" (`CurrentMatchday`, team-level, same value on every player's row)**: `1 + COUNT(DISTINCT MatchParticipation.EventId)` joined to `SportEvent` where `EventTypeId == Match` and `MatchPhase == "finished"`, for the given `TeamId`.
   - *Alternative considered*: import `jornada` from the external RFFM scraping JSON (`CalendarRffm.cs`) when the `SportEvent` is linked to that source. Rejected per user's explicit choice — keeps the feature independent of external-data availability/linkage, which isn't guaranteed for every team.

5. **"Partidos desde la última desconvocatoria" (`MatchesSinceLastDeconvocation`, per player)**: find the player's most recent `Convocation` with `ConvocationStatusId == ConvocationStatus.Deconvoke.Id` whose `SportEvent.EventTypeId == Match`; count finished, `Match`-typed `SportEvent`s for the team with `EveDateTime` strictly after that convocation's event date. If the player has never been deconvoked (on a match) this season, the value equals `MatchesPlayed` (counted from the start of the team's matches).
   - *Alternative considered*: count from the deconvocation event itself inclusive, or return `null`/a sentinel when never deconvoked. Rejected the sentinel — a plain integer is simpler for the Mobile card to render without a null-check branch, and "since the start of the season" is the natural reading of "never deconvoked."

6. **New route + permission**: `CoachFeatureRoutes.PlayerSeasonCards = "/mobile/season-cards"`, seeded in `WebApplicationExtensions.cs` next to `AttendanceConfirmation`: `("PlayerSeasonCards", CoachFeatureRoutes.PlayerSeasonCards, "Player", 1, false)`, same for `FamilyMember` and `Coach` (permType `1` = Read-only, since this is a read-only screen — unlike `AttendanceConfirmation`'s `3`).

7. **New query feature** `GetPlayerSeasonCards` under `Features/Mobile/Players/Queries/`, `IRequireFeaturePermission` (`FeatureRoute = CoachFeatureRoutes.PlayerSeasonCards`, `RequiredPermission = "Read"`) + `IRequireTeamMembership` (same gating shape as `GetEventAttendanceRoster`). Route: `GET /api/mobile/teams/{teamId}/season-player-cards`.
   Response: `List<PlayerSeasonCardDto>`, one per `TeamPlayer` on the team:
   ```
   PlayerSeasonCardDto(
     string TeamPlayerId, string Alias, string? UrlPhoto, int? Dorsal,
     int CurrentMatchday, int MatchesPlayed, int MatchesStarted, int MatchesSinceLastDeconvocation,
     int YellowCards, int RedCards, int Goals,
     int TrainingsAttended, int TrainingsAbsent, int TrainingsPossible)
   ```
   Training fields reuse `GetTrainingAttendanceSummary`'s exact per-player logic (attended/absent/possible), inlined into this handler's own query rather than calling that handler (vertical-slice convention: one feature, self-contained).

8. **Mobile screen**: new `Mobile/src/screens/PlayerSeasonCardsScreen.tsx`, registered as a third tab `PlayersTab` inside `CalendarTabs` (`RootNavigator.tsx`), label "Cromos", icon `Ionicons name="albums-outline"`. Fetches the new endpoint on mount using `teamId` from route params (already threaded through `CalendarTabs`). Cards styled like `EventDetailScreen`'s roster cromo (photo + dorsal badge + name), extended with a small stats grid (matches, starts, cards, goals, trainings) below the name. Photo resolved via the existing `resolvePhotoUrl` util. Read-only — no interaction beyond scrolling/viewing.
   - *Alternative considered*: nest under the existing Calendar/Events flow instead of a new tab. Rejected — the user had no fixed opinion ("no lo sé, búscalo"), and a peer tab next to Calendar/News matches the existing `CalendarTabs` pattern most directly (one tap from anywhere, no drill-down through an event).

## Risks / Trade-offs

- **[Risk] Card counts will show `0` for every player indefinitely** until a separate change adds card-capture UI to Coach web's match-result entry screen → explicitly called out as a Non-Goal; the schema/computation exists and is ready the moment that UI ships.
- **[Risk] "Jornada actual" and "matches since deconvocation" are both derived, not authoritative** (no real matchday/round data source) → mitigated by using one consistent, documented definition (`Decision 3`) everywhere in this feature, so at least the number is internally coherent even if it won't match an external federation matchday number.
- **[Risk] `GetSeasonPlayerStats`'s existing `TotalMatches`/`TotalGoals` (no event-type filter) will diverge from this new endpoint's `MatchesPlayed`/`Goals`** (event-type filtered) once a team has any friendly with saved participation → acceptable since they're different features serving different screens (Coach web's Player detail vs. Mobile's season cards); noted in Decision 3 as an intentional, scoped divergence, not a bug.
- **[Risk] New nullable column migration on `MatchParticipation`** → low risk, purely additive, no backfill needed (existing rows get `null`, parsed as "no cards" same as `GoalsJson`'s null-handling today).

## Migration Plan

- Backend: one EF Core migration adding `CardsJson` (nullable `text`) to `app.MatchParticipations`. No data migration/backfill. `WebApplicationExtensions.cs` seed additions are idempotent (existing `db.FeaturePermissions.Any(...)` guard).
- Mobile: new screen + tab registration, additive only. No changes to existing screens' behavior.
- Front (Coach web): untouched.

## Open Questions

(none — resolved above and via user decisions on tarjetas/jornada/desconvocatoria)
