## Why

Coaches and families currently have no single place in Mobile to see a player's season-long picture: match participation, discipline (cards), goals and training attendance are scattered across three separate backend endpoints (`GetSeasonPlayerStats`, `GetPlayerMatchHistory`, `GetTrainingAttendanceSummary`) and none of them return the player's photo/alias or track cards at all. Coaches want a quick "trading card" (cromo) view per player to spot who's low on minutes, accumulating cards, or missing training.

## What Changes

- **Backend — new domain field**: add `CardsJson` (nullable string, same JSON-blob pattern as `GoalsJson`) to `MatchParticipation`, capturing yellow/red cards per team player for a match. Requires an EF Core migration.
- **Backend — extend match-participation write**: `SaveMatchParticipation.cs` (Coach web's existing match-result entry endpoint) accepts an optional `CardsJson` on the request/`PlayerParticipationDto` and persists it, mirroring how `GoalsJson` is already accepted and stored. No new UI is added to Coach web to *capture* cards in this change (see Non-Goals) — the field simply exists and is honored if a caller supplies it, so a season-cards count can be computed the moment card data starts flowing in.
- **Backend — new aggregated read endpoint**: `GET /api/mobile/teams/{teamId}/season-player-cards`, combining data from the existing season-stats, match-history/convocation, training-summary, and player/team-player tables into one `PlayerSeasonCardDto` per player: `TeamPlayerId, Alias, UrlPhoto, Dorsal, CurrentMatchday, MatchesPlayed, MatchesStarted, MatchesSinceLastDeconvocation, YellowCards, RedCards, Goals, TrainingsAttended, TrainingsAbsent, TrainingsPossible`. No `seasonId` parameter — mirrors `GetSeasonPlayerStats`'s existing convention where `TeamId` alone scopes the season (`SportEvent` has no `SeasonId` FK yet, so per-event season filtering isn't possible; a `Team` is already the season boundary in every existing season-stats endpoint). Gated by a new `CoachFeatureRoutes.PlayerSeasonCards = "/mobile/season-cards"` route with `Read` (permType 1) seeded for `Player`, `FamilyMember`, `Coach`.
- **Backend — "jornada actual" definition**: since the domain has no persisted matchday/round concept (only the external RFFM scraping JSON does), it is computed as `1 + count of the team's finished match-type SportEvents this season` — team-level, independent of any external RFFM data.
- **Backend — "partidos desde la última desconvocatoria"**: computed per player as the count of the team's finished match-type `SportEvent`s strictly after the player's most recent `Convocation` with `ConvocationStatusId == Deconvoke` on a match-type event; if the player has never been deconvoked this season, the value equals `MatchesPlayed` (i.e. counted from the start of the season).
- **Mobile — new screen**: a read-only "Cromos" screen listing every team player as a card (photo, alias, dorsal, and the stats above), styled like the existing `EventDetailScreen` roster cromo cards. Added as a third tab (`PlayersTab`, alongside the existing `CalendarTab`/`NewsTab`) inside `CalendarTabs` in `RootNavigator.tsx`.

## Capabilities

### New Capabilities
- `mobile-player-season-cards`: Mobile screen showing every team player's season attendance/performance summary as a read-only card, available to Coach, Player, and FamilyMember roles.

### Modified Capabilities
(none — no existing spec covers season-aggregated player stats in Mobile)

## Impact

- **Backend**: new EF Core migration adding `CardsJson` to `MatchParticipation`; `SaveMatchParticipation.cs` request/entity update; new query feature under `Features/Mobile/Players/Queries/` (or similar); new `CoachFeatureRoutes.PlayerSeasonCards` constant + 3 seed rows in `WebApplicationExtensions.cs`.
- **Mobile**: new `Mobile/src/screens/PlayerSeasonCardsScreen.tsx` (name TBD in design) + test file; `RootNavigator.tsx`'s `CalendarTabs` gets a third tab.
- **Front (Coach web)**: not touched in this change — no UI added to record cards. Card counts will read as `0` for every player until a future change adds card capture to Coach web's match-result entry screen.
