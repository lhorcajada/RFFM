## Context

- `GetTeamPlayerStatistics` (change archivado `squad-statistics-minutes-target-mobile-layout`) ya
  calcula, solo para categorías F11 (`MatchDurationMinutesByCategory`):
  - `seasonTotalPossibleMinutes`: suma de la duración real de cada partido/amistoso/torneo
    finalizado con participaciones registradas (máximo de `MinutesPlayed` del partido).
  - `MinutesPlayedPercentOfSeasonTotal`: minutos jugados del jugador en ese mismo conjunto de
    partidos sobre el total.
  - `AttributableAbsentMinutesPercentOfSeasonTotal`: duración de los partidos con ausencia
    imputable al jugador sobre el total. Se calcula pero el frontend no lo muestra.
  - `MatchesAbsentAttributableToPlayer`: número de esos partidos (se muestra como "Partidos no
    asistidos: N").
- `AttributableAbsenceCalculator.IsAttributableAbsence` define la ausencia imputable:
  - `AssistanceType` Excused/Unexcused (convocado, no se presentó), o
  - sin asistencia y estado `Justified` o `Deconvoke` con motivo distinto de Decisión técnica.
  Incluye lesión, enfermedad y sanción deportiva. No incluye no convocado ni decisión técnica.
- Decisiones del usuario (confirmadas, no se reabren):
  1. Las lesiones restan de los minutos disponibles, como cualquier motivo que no sea decisión
     técnica.
  2. Convocado, acepta, va al partido y juega 0 minutos: esos minutos siguen siendo disponibles
     (es decisión del entrenador).

## Goals / Non-Goals

**Goals**
- Poder demostrar, por jugador, si no llegar al 30% es por sus ausencias o por decisión del
  entrenador, con un veredicto y la prueba partido a partido.
- Reutilizar la definición existente de ausencia imputable, sin crear otra.

**Non-Goals**
- No cambia `AttributableAbsenceCalculator` ni los ratios "X de Y" de asistencia.
- No cambia el objetivo (30%) ni qué categorías lo tienen.
- Sin migraciones, sin endpoints nuevos, sin cambios en Mobile.

## Decisión 1 — Minutos disponibles y veredicto

```
disponibles = seasonTotalPossibleMinutes − minutosAusenciasImputables
pctDisponibles = minutosJugados / disponibles × 100      (null si disponibles = 0)

si pctTotal ≥ 30                      → Met
si no, si disponibles = 0             → NotMetByOwnAbsences   (no fue a ningún partido)
si no, si pctDisponibles ≥ 30         → NotMetByOwnAbsences
si no                                 → NotMet
```

- `minutosJugados` es el mismo numerador de `MinutesPlayedPercentOfSeasonTotal` (solo partidos del
  conjunto del denominador).
- Un partido con ausencia imputable sin participaciones registradas (nadie jugó) no suma minutos,
  ni al total ni a las ausencias, igual que hoy.
- Categoría no F11 o total 0: `MinutesPlayedPercentOfAvailable` y `MinutesTargetStatus` son `null`.
- Se compara sin redondear, igual que la barra actual.

Ejemplo (5 partidos de 80', total 400'):

| Jugador | Jugados | Ausencias imputables | % total | Disponibles | % disponibles | Veredicto |
|---|---|---|---|---|---|---|
| A | 130' | 0 | 32,5% | 400' | 32,5% | Met |
| B | 100' | 2 partidos (160') | 25% | 240' | 41,7% | NotMetByOwnAbsences |
| C | 60' | 1 partido (80') | 15% | 320' | 18,8% | NotMet |
| D | 0' | 5 partidos (400') | 0% | 0' | — | NotMetByOwnAbsences |

## Decisión 2 — Lista de ausencias imputables

Mismo conjunto que `MatchesAbsentAttributableToPlayer`: partidos/amistosos/torneos finalizados de
la temporada con ausencia imputable. Uno por partido, del más reciente al más antiguo.

| Estado de la convocatoria | `Kind` | Texto en la UI |
|---|---|---|
| `AssistanceType` Excused / Unexcused | `NoShow` | "No se presentó" |
| Sin asistencia, estado `Justified` o `Deconvoke` (no técnica) | `Declined` | "Rechazó la convocatoria" |

`Reason`: nombre del `ExcuseType` si lo hay (Lesión, Enfermedad, Sanción deportiva…); si no,
`null` (la UI muestra solo el `Kind`).

`MatchMinutes`: duración del partido usada en el cálculo (`matchDurationByEventId`), `0` si no
tiene participaciones. Solo se rellena en F11; en el resto de categorías la lista existe igual
(el número de ausencias ya se muestra hoy para todas) con `MatchMinutes` `0`.

`Opponent`: `Rival.Name` si el evento tiene rival; si no, `SportEvent.Name`.

## Decisión 3 — Contrato API (aditivo)

```csharp
double? MinutesPlayedPercentOfAvailable,      // null si no F11, total 0 o disponibles 0
string? MinutesTargetStatus,                  // "Met" | "NotMetByOwnAbsences" | "NotMet"; null si no F11 o total 0
AttributableAbsenceDto[] AttributableAbsences // nunca null

public record AttributableAbsenceDto(
    string EventId, DateTime Date, int EventTypeId, string Opponent,
    int MatchMinutes, string Kind, string? Reason);   // Kind: "NoShow" | "Declined"
```

Los campos existentes no cambian. `MinutesTargetStatus` se expone como string (mismo estilo que
`Kind`/`Status` en otros DTOs de este handler).

## Decisión 4 — Handler

- La proyección de `matchLikeFinishedEventIds` pasa a traer `Id, EveDateTime, EventTypeId, Name,
  RivalName (Rival != null ? Rival.Name : null)` en la misma query (sin query nueva).
- `attributableAbsencesByPlayer` pasa de lista de ids a lista de convocatorias (ya tiene
  `AssistanceTypeId`, `ConvocationStatusId`, `ExcuseTypeId`), para derivar `Kind` y `Reason`.

## Decisión 5 — Frontend (front-specialist)

En la tarjeta de `SquadStatistics` (bloque `squad-stat-minutes-target`):

- **Barra**: tras el tramo verde de minutos jugados, un tramo rayado con
  `attributableAbsentMinutesPercentOfSeasonTotal` (limitado al 100% entre los dos). La marca del
  30% se mantiene. Accesible: `aria-label` en el bloque con el texto del veredicto.
- **Veredicto** (texto bajo la barra):
  - `Met`: "Cumple el objetivo".
  - `NotMetByOwnAbsences`: "No llega por sus ausencias: {pct}% de sus minutos disponibles", o
    "No llega por sus ausencias: no ha acudido a ningún partido" si no hay disponibles.
  - `NotMet`: "No llega al objetivo: {pct}% de sus minutos disponibles".
- **Ausencias**: el texto "Partidos no asistidos: N" se convierte en un botón (si N > 0) que
  despliega (`Collapse`) una lista de tarjetas: "12/10 · Liga vs CD Rival · 80' · Rechazó la
  convocatoria · Lesión". Sin tablas. Responsive a 360px.
- Estilos en `SquadStatistics.module.css` con los tokens del tema Coach. El `style={{ width }}`
  inline para anchos de barra ya es el patrón de este archivo.
- Textos compartidos en `playerStatsText.ts` (veredicto y línea de ausencia) para que tarjeta y
  PDF no diverjan.
- El bloque se extrae de `SquadStatistics.tsx` a `SeasonMinutesTarget.tsx` (+ `.module.css`, al
  que se mueven las clases de la barra), porque ahora tiene estado propio (desplegable). Los
  colores del veredicto salen del tema (`success`/`warning`/`error.main`).

PDF (`squadStatsPdfExport.ts`): tras "% minutos jugados", una línea con el veredicto y una línea por
ausencia con el mismo texto de la tarjeta.
