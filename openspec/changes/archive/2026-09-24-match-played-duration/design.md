## Context

- `GetTeamPlayerStatistics` calcula `matchDurationByEventId` como el máximo `MinutesPlayed` entre
  las participaciones `finished` de cada partido (change `squad-statistics-minutes-target-mobile-layout`).
  El denominador del objetivo de minutos, el tramo de ausencias y `MatchMinutes` de
  `AttributableAbsences` (change `season-minutes-target-attributable-absences`) salen de ahí.
- `SaveMatchParticipation` (`POST /api/events/{eventId}/match-participation`) ya actualiza
  `SportEvent.LocalGoals/VisitorGoals` cuando `MatchPhase == "finished"`.
- En el frontend, `useLiveMatch.ts` lleva `halfDuration` (minutos por parte) y el cronómetro; al
  terminar (`endMatch`) congela los segundos. `persistMatchParticipation` envía el payload.
  `LiveMatchManualEditDialog` permite editar resultado, minutos, goles y tarjetas a mano.
- Decisiones del usuario (confirmadas):
  1. La duración del partido se puede editar en el directo, por si no se pudo seguir en directo, y
     el cálculo usa siempre ese valor.
  2. Si el valor es 0 o nulo, se usan los minutos de la categoría.
  3. Al cerrar un partido en directo la duración se rellena sola con lo jugado (partes
     configuradas más añadido); el entrenador puede corregirla.

## Goals / Non-Goals

**Goals**
- Duración real del partido persistida por evento y editable.
- El objetivo de minutos deja de depender de cuánto jugó el que más jugó.

**Non-Goals**
- Estado de forma, Rodaje y Cansancio no cambian: siguen usando la duración de la categoría como
  referencia.
- Sin edición de la duración fuera del directo (ficha del evento, calendario).
- Categorías sin duración estándar (no F11) siguen sin objetivo de minutos.

## Decisión 1 — Dónde se guarda

`SportEvent.MatchDurationMinutes` (`int?`), en el evento y no en cada `MatchParticipation`, porque
es un dato del partido (igual que el resultado). Migración `AddMatchDurationMinutesToSportEvent`
en commit separado.

## Decisión 2 — Contrato

- `SaveMatchParticipationRequest.MatchDurationMinutes` (`int?`, opcional). Solo se aplica cuando
  `MatchPhase == "finished"`, junto al resultado. Si no viene (clientes antiguos), no se toca el
  valor guardado.
- Validación: 0-200 (mismo rango que los minutos por jugador en el diálogo manual). Fuera de
  rango → 400 `ProblemDetails`.
- `MatchParticipationResponse.MatchDurationMinutes` (`int?`).
- El `Validator` de `SaveMatchParticipation` se registra a mano en DI (no hay escaneo de
  validadores); `ValidationBehavior` lo convierte en 400 `ProblemDetails`.
- El límite 200 vive en `SaveMatchParticipation.MaxMatchDurationMinutes` (backend) y en
  `MAX_MATCH_DURATION_MINUTES` de `liveMatch.types.ts` (frontend), compartido por el hook y el diálogo.

## Decisión 3 — Autorrelleno en el directo

En `useLiveMatch`:

```
al terminar el partido (endMatch):
    matchDurationMinutes = minuto final del cronómetro (segundos congelados / 60, redondeado)
    si es 0 → 2 × halfDuration
```

- Se guarda en el estado, se envía en el payload y se restaura desde `getMatchParticipation` y
  desde la copia local del partido en curso.
- En `LiveMatchManualEditDialog`, sección "Resultado": campo numérico "Duración del partido
  (min)", prellenado con el valor actual o, si no hay, con 2 × `halfDuration`. Validación 0-200,
  con el mismo mensaje de error que los minutos. Texto de ayuda: "Si lo dejas en 0 se usa la
  duración de la categoría".

## Decisión 4 — Objetivo de minutos

```
duración(evento) = MatchDurationMinutes > 0 ? MatchDurationMinutes : 2 × minutos por parte de la categoría
minutos del jugador en el evento = min(MinutesPlayed, duración(evento))
```

- Cuenta cualquier partido/amistoso/torneo finalizado de la temporada que tenga al menos una
  participación `finished` (igual que hoy: un partido sin nada registrado sigue sin contar).
- `MatchMinutes` de `AttributableAbsences` usa la misma duración.
- Ejemplo del caso real: dos partidos de Cadete sin duración guardada → 160'; 50' jugados → 31,25%
  (31,2 con el redondeo a 1 decimal existente; 31% en pantalla).

## Decisión 5 — Tests

- Backend: `SaveMatchParticipation` guarda/ignora/valida la duración; `GetMatchParticipation` la
  devuelve; `GetTeamPlayerStatistics` usa duración guardada, cae a la categoría con 0/null, y
  limita los minutos del jugador a la duración.
- Frontend: autorrelleno al terminar (minuto final y fallback 2 × parte), campo en el diálogo
  manual (prellenado, validación, se envía en el payload), restauración desde el backend.
