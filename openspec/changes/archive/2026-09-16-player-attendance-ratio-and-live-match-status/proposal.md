## Why

Player stats currently show raw counts (`trainingsAttended`, `matchesPlayed`) with no denominator, so
a coach cannot tell attendance rate from volume of activity. Separately, `Convocation` already models
"accepted then didn't show" (`AssistanceType.ExcusedAbsence`/`UnexcusedAbsence`) via the existing
Asistencia tab, but this state is invisible in the live-match views (`PartidoEnDirectoTab`,
`SimulacionTab`, `BenchPlayerCard`, `AlineacionTab`): a player with 0 minutes looks identical whether
they were never called up, were absent (justified or not), or arrived late — the coach has no way to
tell why a player didn't play without leaving the screen. `AssistanceType.LateArrival` also has no
reason attached today (`UpdateConvocationAssistance` clears `ExcuseTypeId` for any type other than
`ExcusedAbsence`).

## What Changes

- Backend: player stats (`GetTeamPlayerStatistics`/wherever `trainingsAttended`/`matchesPlayed` are
  computed) become a ratio — finished team events of that type (Entrenamiento/Amistoso/Liga) since
  the player joined the squad, vs. events the player actually attended (`AssistanceType.Attendance`
  or `LateArrival`).
- Backend: allow `ExcuseTypeId` alongside `AssistanceType.LateArrival` in `UpdateConvocationAssistance`
  (currently only allowed for `ExcusedAbsence`), so "llegó tarde" can carry a reason.
- Backend: expose each player's convocation/assistance state (`AssistanceTypeId`, `ExcuseTypeId`,
  `ConvocationStatusId`) in the live-match roster read models (`GetMatchParticipation`/
  `GetEventPlayers`/`GetEventConvocations`, whichever feeds the live-match UI).
- Frontend: `SquadStatistics`/`PlayerConvocationSummaryCard` show "X de Y" (attended/possible) per
  event type instead of a bare count.
- Frontend: live-match roster (bench + on-field lists in `PartidoEnDirectoTab`/`SimulacionTab`/
  `BenchPlayerCard`) shows a badge/label for 0-minute players: "No asistió (justificado/injustificado)"
  or "Llegó tarde" + reason, instead of a bare `—`.

## Capabilities

### Modified Capabilities
- `player-statistics`: attendance counts become ratios against possible finished events.
- `live-match-roster` (new capability entry, no existing spec found): surfaces per-player
  attendance/lateness state and reason for 0-minute players.

## Impact

- Backend: stats query feature (`GetTeamPlayerStatistics` and/or `GetSeasonPlayerStats`), live-match
  roster queries (`GetMatchParticipation`, `GetEventPlayers`/`GetEventConvocations`),
  `UpdateConvocationAssistance.cs` validator change, corresponding xUnit tests.
- Frontend: `teamPlayerStatisticsService.ts`, `SquadStatistics.tsx`, `liveMatchService.ts`/
  `convocationService.ts` types, `useConvocationPlayerViews.ts` (`SquadPlayer` type), `BenchPlayerCard.tsx`,
  `PartidoEnDirectoTab.tsx`/`SimulacionTab.tsx`, corresponding Vitest tests.
