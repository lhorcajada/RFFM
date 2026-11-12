## Why

La propuesta de desconvocatoria puntúa a cada jugador con reglas cuyo texto, puntos y pesos están fijados como constantes en el código (`Front/.../convocations/utils/rules/*.ts`, `attendanceWeights.ts`). El entrenador no puede adaptarlas a su criterio sin un cambio de código (issue lhorcajada/RFFM#14).

## What Changes

- El entrenador puede configurar, **por equipo**, las reglas de la propuesta de desconvocatoria: editar texto, puntos y pesos de las reglas existentes, y añadir o eliminar reglas.
- Todas las reglas son editables, también las obligatorias (lesionado, recuperación reciente, sin asistir a entrenos en semana de partido): se puede cambiar su texto y puntos, o eliminarlas.
- Al añadir una regla se elige de un catálogo de condiciones ya disponibles (goles, racha, asistencia, lesión, etc.); solo una regla por condición.
- Cada regla muestra sus **puntos** y sus **pesos** por separado.
- Existe una configuración por defecto (los valores actuales del código) y una acción para restablecerla.
- La configuración se persiste en backend por equipo (tabla nueva en `AppDbContext` + endpoints GET/PUT/DELETE). Sin fila se aplica el valor por defecto.
- El motor de reglas (`runRules`) deja de usar constantes y recibe la configuración del equipo.
- La pantalla de la propuesta tiene un botón **Actualizar** que recarga la configuración vigente y regenera la propuesta.
- Los cambios no se aplican a propuestas de partidos pasados (la propuesta se recalcula en vivo; no se guarda).

## Capabilities

### New Capabilities
- `deconvoke-proposal-rules-config`: configuración por equipo de las reglas de puntuación de la propuesta de desconvocatoria (catálogo de condiciones, puntos y pesos, valor por defecto, restablecer, botón Actualizar).

### Modified Capabilities
<!-- Ninguna: `deconvoke-proposal-positions` (mínimos por posición) no cambia. -->

## Impact

- **Front**: `convocations/utils/rules/*` (motor parametrizable + catálogo + configuración por defecto), `deconvokeProposal.ts`, `useConvocationProposal.ts`, `ConvocationTab.tsx` / `ConvocationMatchDetail.tsx` (botón Actualizar), nuevo servicio `deconvocationRulesService.ts`, nuevo diálogo de configuración (tarjetas, mobile-first, sin tablas).
- **Back**: nueva entidad `DeconvocationRulesSettings` (JSON por equipo), 3 features vertical slice, migración EF (commit aparte).
- **Versionado**: `feat` → minor en `Front/package.json` y `Back/ExtractionApi/Directory.Build.props`.
- **Fuera de alcance**: app móvil; aplicar cambios a propuestas de partidos pasados.

## Proposal Research Documentation

**Local files**:
- Front/src/apps/coach/pages/convocations/utils/deconvokeProposal.ts
- Front/src/apps/coach/pages/convocations/utils/rules/ (index, types, goals, streak, minimum, recentDeconvocation, technicalTotal, rivalResult, weeklyTraining, injured, recentRecovery, combined)
- Front/src/apps/coach/pages/convocations/utils/attendanceWeights.ts
- Front/src/apps/coach/pages/convocations/hooks/useConvocationProposal.ts
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/Teams/QuinielaTeamSettings.cs (patrón de ajustes por equipo)
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Quiniela/GetQuinielaSettings.cs y UpdateQuinielaSettings.cs
- openspec/specs/deconvoke-proposal-positions/spec.md

**External URLs**:
- https://github.com/lhorcajada/RFFM/issues/14

## Additional Notes

- `combinedRule` emite tres factores (`rating`, `necessity`, `weeklyTrainingAccum`); en el catálogo se separan en tres condiciones independientes.
- Entran en el catálogo: `injured`, `recentRecovery` y `weeklyTraining` (con su rama forzada), obligatorias por defecto. La protección por posición, el bloqueo de portero y `matchUnavailable` no son reglas puntuables y quedan fuera del catálogo.
- `attendanceWeights.ts` (penalización por excusa) es el candidato natural a «pesos» de la condición de asistencia semanal.
