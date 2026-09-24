## Why

El objetivo de minutos de temporada (30%) usa como duración de cada partido la del jugador que
más minutos jugó. Si el entrenador rota y nadie pasa de 70' en un partido de 80', el sistema cree
que duró 70' e infla el porcentaje de todos. Caso real: un jugador con 50' en dos partidos de 80'
aparece con 33% (50/150) en vez de 31% (50/160). Además, si el partido no se pudo seguir en
directo, no hay forma de indicar cuánto duró de verdad.

## What Changes

- **Duración del partido guardada en el evento** (`SportEvent.MatchDurationMinutes`, entero
  nullable, migración nueva).
- **Se rellena sola al guardar un partido en directo terminado** con el minuto final del
  cronómetro (partes configuradas más el añadido). Si el cronómetro no se usó, se toma
  2 × minutos por parte configurados.
- **Se puede editar** en "Edición manual del partido" (campo "Duración del partido"), pensado
  para cuando el partido no se pudo seguir en directo.
- **Objetivo de minutos**: la duración de cada partido es `MatchDurationMinutes` si es > 0; si es
  0 o nulo, la duración estándar de la categoría (2 × minutos por parte: Cadete 80'). Deja de
  usarse el máximo de minutos jugados. Los minutos de un jugador en un partido cuentan como
  máximo hasta su duración, para que el % no pase de 100.
- `GET /api/events/{eventId}/match-participation` devuelve `MatchDurationMinutes`; `POST` lo
  acepta (opcional, retrocompatible).

## Capabilities

### New Capabilities
- `match-played-duration`: duración real de un partido, guardada y editable desde el directo.

### Modified Capabilities
- `player-season-minutes-target`: la duración de cada partido sale de la duración guardada o de
  la categoría, no del máximo de minutos jugados.

## Impact

- Backend: `SportEvent` (+ configuración EF + migración), `SaveMatchParticipation`,
  `GetMatchParticipation`, `GetTeamPlayerStatistics` y sus tests.
- Frontend: `useLiveMatch.ts` (estado, payload, restauración), `LiveMatchManualEditDialog.tsx`,
  tipos del servicio de participación y tests.
- Sin cambios en Estado de forma/Rodaje/Cansancio (siguen usando los minutos de cada jugador y la
  duración de la categoría).
