## Why

En las pestañas "Simular Partido" (`SimulacionTab` → `useMatchSimulation`) y "Partido en Directo"
(`PartidoEnDirectoTab` → `useLiveMatch`) de Convocatorias, la duración de cada parte arranca con un
valor fijo hardcodeado (35 min en simulación, 45 min en directo) independientemente de la categoría
real del equipo. El entrenador puede cambiarla manualmente desde `SimulationConfig`, pero el valor
por defecto no refleja la duración estándar F11 de la categoría (Alevín 30, Infantil 35, Cadete 40,
Juvenil 45 — la misma tabla ya usada en el backend para el objetivo de minutos de temporada, ver
`MatchDurationMinutesByCategory`). Esto obliga al entrenador a corregir el valor cada partido para
categorías distintas de la que casualmente coincide con el default actual.

## What Changes

- Backend (`GetTeam.cs`): añadir `StandardHalfDurationMinutes` (`int?`) a `TeamResponse`, resuelto
  vía `MatchDurationMinutesByCategory.TryGetMinutes(team.CategoryId, out var minutes)` (reutiliza la
  entidad de dominio ya existente, sin duplicar la tabla categoría→minutos). `null` para categorías
  no F11 (Nacional/Aficionados/Benjamines/Prebenjamines/Debutantes), igual que ya hace el resto del
  sistema para esas categorías.
- Frontend (`teamService.ts`): añadir `standardHalfDurationMinutes: number | null` al tipo
  `TeamResponse`.
- Frontend (`SimulacionTab.tsx`, `PartidoEnDirectoTab.tsx`): al montar, resolver el equipo con
  `getTeamById(teamId)` y, si el partido sigue en `preMatch` (aún no iniciado) y el entrenador no ha
  tocado ya la duración manualmente, fijar `halfDuration` al valor estándar de la categoría en vez
  del valor fijo actual (35 / 45). Si la categoría no tiene duración estándar (`null`), se mantiene
  el valor por defecto actual sin cambios.
- El entrenador sigue pudiendo editar la duración libremente desde `SimulationConfig` en cualquier
  momento antes de iniciar el partido — este cambio solo afecta al valor con el que arranca el
  formulario, no restringe ni valida la edición manual.

## Capabilities

### Added Capabilities
- `coach-match-duration-defaults`: el valor inicial de `halfDuration` en Simulación y Partido en
  Directo se resuelve por categoría del equipo en vez de un valor fijo, manteniendo la edición
  manual existente.

## Impact

- Backend: `Features/Coaches/Teams/Queries/GetTeam.cs`, tests xUnit existentes/nuevos para ese
  handler.
- Frontend: `services/teamService.ts`, `pages/convocations/components/SimulacionTab.tsx`,
  `pages/convocations/components/PartidoEnDirectoTab.tsx`, tests Vitest nuevos/existentes de ambos
  componentes.
