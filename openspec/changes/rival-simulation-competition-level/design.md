## Context

`SquadStrengthCalculator` (D2 de `rival-match-simulation`) puntúa a cada jugador con
`0,60·puesto + 0,25·titularidad + 0,15·goles`, con el tamaño de grupo estimado por el mayor puesto visto
(mínimo 10) y una fuerza lineal `Q / media`. Las participaciones (`SimPlayerParticipation`) ya traen
`CompetitionName` (p. ej. «PRIMERA INFANTIL», «SEGUNDA CADETE», «PRIMERA DIVISION AUTONOMICA CADETE»).

`rival-simulation-history` (sin commitear) guarda simulaciones por jornada congeladas al empezar; las
rellenadas a posteriori se guardan congeladas y, tal cual, no se recalcularían con un modelo corregido.

## Decisions

### D1 — `CompetitionLevel` (dominio, puro)

`Domain/Services/MatchSimulation/CompetitionLevel.cs`:

```csharp
public static class CompetitionLevel
{
    public static int? Division(string competitionName); // null si no se reconoce
    public static int? AgeCategory(string competitionName);
    public static int? Level(string competitionName);    // Division + AgeCategory; null si falta la división
}
```

- Normaliza: mayúsculas, sin tildes, espacios simples.
- División (se comprueban primero los nombres largos): «SUPERLIGA» 6, «DIVISION DE HONOR» 5,
  «PRIMERA DIVISION AUTONOMICA» / «PRIMERA AUTONOMICA» 4, «PREFERENTE» 3, «PRIMERA» 2, «SEGUNDA» 1,
  «TERCERA» 0.
- Edad: «PREBENJAMIN» 0, «BENJAMIN» 1, «ALEVIN» 2, «INFANTIL» 3, «CADETE» 4, «JUVENIL» 5,
  «AFICIONADO» / «SENIOR» 6. Si no aparece, se usa el rango de edad más frecuente entre las
  participaciones reconocidas de la liga (o 0 si no hay ninguno): la escala es relativa entre equipos.
- Escala absoluta: la fuerza se normaliza contra la media de la liga, así que el origen da igual.

### D2 — Valor de un jugador y fuerza del equipo

En `SquadStrengthCalculator`:

- `positionScore = 1 − (pos − 1) / (N − 1)`, `N = max(mayor puesto visto en ese grupo, pos, 16)`.
- Valor de una participación = `Level + positionScore`. Participaciones sin división reconocible se
  descartan.
- Valor del jugador con temporada anterior y al menos una participación válida:
  `0,7·max + 0,3·media` de sus participaciones `+ 0,2·titularidad + 0,1·goles`
  (titularidad = titular/convocado; goles = `min(goles/jugados, 1,5)/1,5`).
- Jugador sin temporada anterior o sin participaciones válidas: `media de la liga − 0,25` (equivale al
  antiguo 0,95 en una escala absoluta; un jugador nuevo cuenta algo por debajo de la media).
- Peso del jugador sin cambios: `0,25 + titular actual + 0,5·suplente actual`.
- `Q(equipo)` = media ponderada; **fuerza** `s = e^(K·(Q − media de Q))` con `K = 0,6`, acotada a
  `[MinStrength = 0,5, MaxStrength = 2]`. Equipo sin plantilla → 1.

Comprobación con los datos reales: FEPE ≈ 5,27 y MÓSTOLES ≈ 5,86; con `K = 0,6` el rival sale favorito aun
jugando fuera (≈ 28 % / 25 % / 47 %).

### D3 — Versión del modelo y recálculo de jornadas rellenadas

- `SeasonSimulator.ModelVersion = 2` (la de `rival-match-simulation` es la 1).
- `RffmRoundSimulation`: `ModelVersion` (int) e `IsBackfilled` (bool). `Create(..., modelVersion, isBackfilled, now)`;
  `Replace(data, modelVersion, now)` (solo abiertas); nuevo `RecomputeBackfilled(data, modelVersion, now)`:
  solo si `IsBackfilled` y `modelVersion > ModelVersion`; actualiza datos y `ComputedAt`, mantiene la
  congelación. Devuelve `bool`.
- `RivalRoundSimulationService.SyncAsync`: una simulación congelada y rellenada a posteriori con versión
  antigua se recalcula (sin implicación actual); las congeladas en su momento real (`IsBackfilled = false`)
  nunca. Al congelar una abierta al empezar la jornada, `IsBackfilled` sigue en `false`.
- `AddRffmRoundSimulations` (`20261022123532`) ya está aplicada en la base de datos real con simulaciones
  guardadas, así que no se modifica: la nueva migración `AddModelVersionToRffmRoundSimulations` añade las dos
  columnas y marca `IsBackfilled = true` en las filas con `FrozenAt = ComputedAt` (las rellenadas a
  posteriori se congelan en el mismo instante en que se calculan). Con `ModelVersion = 0` se recalculan en la
  siguiente sincronización. Test de regresión: `RffmRoundSimulationMigrationTests`.

### D4 — Historial y página

- `RoundSimulationResponse` añade `IsBackfilled`.
- Front: `RoundSimulation.isBackfilled`; en una jornada guardada con `isBackfilled`, el texto de cabecera
  dice «Predicción calculada a posteriori con N partidos disputados antes de esta jornada».

## Risks / Trade-offs

- Nombres de competición no reconocidos (copas, torneos): sus participaciones se descartan; si un jugador
  solo tiene esas, cuenta como nuevo.
- `0,7·max` favorece a quien jugó alguna vez en una categoría superior aunque fuera poco (la RFFM no da
  partidos por participación).
- `K = 0,6` es una elección razonada, no calibrada; se ajustará con el historial de aciertos.
