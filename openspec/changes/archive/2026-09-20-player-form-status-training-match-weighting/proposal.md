## Why

`PlayerFatigueCalculator` y `PlayerReadinessCalculator` tratan todos los entrenamientos igual
(un entreno físico pesa lo mismo que uno táctico o técnico) y todos los partidos igual (un
amistoso pesa lo mismo que un partido de Liga), a pesar de que `SportEvent.TrainingTypes`
(Físico/Técnico/Táctico) y el tipo de evento (`Partido`/`Amistoso`) ya están persistidos. El
usuario quiere que el tipo de sesión module el impacto real en Cansancio y Rodaje, y además
quiere una tercera métrica de backend, "Estado de forma", independiente de la resta
Rodaje-Cansancio que hoy calcula el frontend (`computeEf`) — el estado físico del jugador no es
lo mismo que "no estar cansado y tener buen rodaje reciente": mejora sobre todo con trabajo
físico, nada con trabajo técnico.

## What Changes

- `PlayerFatigueCalculator`: cada entreno pondera su contribución decayed por el/los tipo(s) de
  entrenamiento presentes en esa sesión (Físico > Táctico > Técnico); cada partido pondera sus
  minutos por tipo de evento (Liga > Amistoso/Torneo).
- `PlayerReadinessCalculator`: mismo mecanismo de ponderación por tipo de sesión/tipo de partido,
  pero con orden distinto para Rodaje (Táctico > Técnico > Físico=0 en entrenos; Liga > Amistoso/
  Torneo en partidos, igual que Cansancio).
- **BREAKING** (interno, no de API pública): ambas firmas de `Calculate(...)` cambian para
  recibir el/los tipo(s) de entrenamiento y el tipo de evento de partido junto a cada dato ya
  existente.
- Nueva capability: `PlayerFormStatusCalculator` — calcula "Estado de forma" (0-100 o `null`),
  un tercer valor de backend, no derivado de Rodaje/Cansancio, sobre la misma ventana de 8
  semanas que Rodaje. Físico mejora el Estado de forma más que Táctico; Técnico no aporta nada;
  partidos de Liga pesan más que Amistoso/Torneo.
- `GetTeamPlayerStatistics.cs`: añade `FormStatus: int?` y `FormStatusBreakdown` (análogo a
  `ReadinessBreakdown`) al `PlayerStatisticsDto`. Amplía las proyecciones EF de `SportEvents`
  para incluir `TrainingTypes`/`EventTypeId` (ya persistidos, sin queries nuevas).
- Frontend (Front/src/apps/coach, a implementar por front-specialist en un cambio posterior):
  `PlayerFormBars` deja de calcular "Ef" con `computeEf` y consume directamente `FormStatus` del
  backend en `SquadStatistics.tsx`, `squadStatsPdfExport.ts` y la pestaña "Estadísticas" de
  `PlayerDetail.tsx`. El contrato de API (nombre/forma del campo) queda cerrado en este diseño.

## Capabilities

### New Capabilities
- `player-form-status`: nueva métrica de backend "Estado de forma" (0-100 o `null`), derivada de
  asistencia real a entrenamiento (ponderada por tipo, físico > táctico, técnico = 0) y minutos
  de partido (ponderados por tipo de partido), sobre una ventana de 8 semanas.
- `player-readiness`: formaliza como spec propia el cálculo existente de Rodaje
  (`PlayerReadinessCalculator`, introducido en `squad-statistics-form-status` sin spec propia),
  incorporando ahora la ponderación por tipo de entrenamiento/partido.

### Modified Capabilities
- `player-fatigue`: el cálculo de Cansancio incorpora ponderación por tipo de entrenamiento
  (Físico > Táctico > Técnico) y por tipo de partido (Liga > Amistoso/Torneo), además del
  decaimiento por recencia ya existente.

## Impact

- Backend: modifica `Features/Coaches/Players/Services/PlayerFatigueCalculator.cs` y
  `PlayerReadinessCalculator.cs` (nueva firma de `Calculate`, tablas de pesos por tipo), añade
  `PlayerFormStatusCalculator.cs` y un helper compartido de ponderación por tipo de sesión en la
  misma carpeta `Services/`. Modifica `Features/Coaches/Players/Queries/GetTeamPlayerStatistics.cs`
  (nuevas proyecciones `TrainingTypes`/`EventTypeId`, nuevo campo `FormStatus` en el DTO).
  Actualiza `PlayerFatigueCalculatorTests.cs`, `PlayerReadinessCalculatorTests.cs`,
  `GetTeamPlayerStatisticsHandlerTests.cs`, añade `PlayerFormStatusCalculatorTests.cs`.
- Frontend: sin cambios en este change — el contrato del nuevo campo `FormStatus` queda decidido
  en `design.md` para que un change posterior (front-specialist) reemplace `computeEf`/"Ef" por
  este valor en `PlayerFormBars`, `SquadStatistics.tsx`, `squadStatsPdfExport.ts` y
  `PlayerDetail.tsx`, y pueda eventualmente eliminar `playerFormMetrics.ts::computeEf`.
- Sin migraciones EF nuevas: `TrainingTypes` y `EventTypeId` ya existen y están persistidos.
