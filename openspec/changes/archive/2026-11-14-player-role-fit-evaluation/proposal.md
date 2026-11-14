## Why

La hoja de valoración actual mide cuánto vale cada jugador con 28 características genéricas (capacidad), pero no mide si cumple lo que el modelo de juego exige en su puesto. Un jugador con buen físico y técnica (caso Araque, mediocentro defensivo) sale alto en la hoja y aun así se desconvoca porque otros con menos físico hacen mejor el rol. El cuerpo técnico necesita revisar cada semana el encaje por puesto para convocar y desconvocar con criterio.

## What Changes

- Nuevo catálogo común de 12 rasgos de conducta «lo hace en partido», agrupados por fase del juego (con balón, sin balón, transiciones, transversales), con escala de 5 niveles.
- 8 puestos unificados para evaluar: Portero, Central, Lateral/Carrilero, Mediocentro defensivo, Mediocentro (incluye interior y mediocampista izquierdo/derecho), Mediapunta (incluye medio centro ofensivo), Extremo y Delantero. El lado izquierdo/derecho no cambia de puesto. El Portero queda fuera de la v1 y mantiene su hoja actual.
- Cada puesto define el peso de cada rasgo (clave / suma / indiferente). El jugador se valora una sola vez y esa valoración sirve para todos los puestos donde compite.
- Nueva vista semanal por puesto: la herramienta propone un orden de encaje (rasgos × pesos) y el entrenador lo corrige arrastrando tarjetas. El orden confirmado queda guardado por semana.
- Cada semana la valoración parte de la anterior y solo se marcan los cambios; cada jugador lleva una tendencia (sube / igual / baja) que desempata.
- El encaje en el puesto entra en la propuesta de desconvocatoria como criterio nuevo y explicable en la tarjeta del jugador.
- Las 28 características actuales se mantienen como «capacidad» (puede); lo nuevo mide «lo hace». No hay cambios incompatibles.

## Capabilities

### New Capabilities
- `player-behavior-traits-rating`: catálogo de rasgos de conducta, valoración semanal de jugadores de campo con arrastre de la semana anterior y tendencia.
- `position-fit-ranking`: puestos unificados, pesos de rasgos por puesto, cálculo del encaje y orden semanal por puesto con corrección manual del entrenador.

### Modified Capabilities
- `deconvocation-tiered-selection`: el encaje en el puesto pasa a ser un criterio del embudo de decisión, sin sustituir a protecciones ni a mínimos por posición.
- `squad-rating-sheets`: la página `/coach/squad/rating-sheet` incorpora acceso a la valoración por rasgos y a la vista de orden por puesto.

## Impact

- Frontend: `Front/src/apps/coach/pages/squad/rating/` (`RatingSheetPage`, `RatingSheetBoard`, `useRatingSheet`, `ratingConcepts`, `positionCategory`), `Front/src/apps/coach/types/playerRating.ts`, nuevo servicio de valoraciones por rasgos y `Front/src/apps/coach/pages/convocations/utils/deconvokeProposal.ts` y su tarjeta.
- Backend: nuevas entidades y endpoints de valoración por rasgos y de orden por puesto en `Back/ExtractionApi` (AppDbContext, migración), siguiendo el patrón de `POST /api/catalog/team/{teamId}/ratings`.
- Datos: reutiliza `DemarcationMaster`, `activePositionId` y `possibleDemarcationIds` ya expuestos por `GET /api/catalog/team/{teamId}/players` para saber en qué puestos compite cada jugador.
- Versionado: `feat` en Front y API, subida de minor en cada uno.

## Proposal Research Documentation

**Local files**:
- Front/src/apps/coach/pages/squad/rating/RatingSheetPage.tsx
- Front/src/apps/coach/pages/squad/rating/useRatingSheet.ts
- Front/src/apps/coach/pages/squad/rating/components/RatingSheetBoard.tsx
- Front/src/apps/coach/pages/squad/rating/ratingConcepts.ts
- Front/src/apps/coach/types/playerRating.ts
- Front/src/apps/coach/pages/convocations/utils/deconvokeProposal.ts
- Front/src/apps/coach/pages/convocations/utils/rules/types.ts
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/GameModels/Queries/GetGameModel.cs
- openspec/specs/squad-rating-sheets/spec.md
- openspec/specs/deconvocation-tiered-selection/spec.md
- openspec/specs/deconvoke-proposal-positions/spec.md
- openspec/changes/archive/2026-10-26-game-model-redesign/design.md
- docs/game-model/ADN-modelo-de-juego-especificacion-tecnica.md

**External URLs**:
- (ninguna)

## Additional Notes

- El campo `rol` de los sub-subprincipios del modelo de juego es texto libre («Delantero», «Central», «Jugador más cercano al balón»); no está ligado a posiciones, por eso los rasgos forman un catálogo propio y no se derivan automáticamente del modelo en la v1.
- `DemarcationMaster` solo tiene 14 demarcaciones (POR, LI, LD, DFC, LIB, MC, MCD, MCO, MI, MD, DC, SD, EI, ED): carrilero, interior y media punta no existen como demarcación, así que los 8 puestos agrupan las 14 existentes y no se añaden demarcaciones nuevas.
- La propuesta de desconvocatoria ya reconoce roles por posición activa (`deconvoke-proposal-positions`); los 8 puestos de esta valoración deben mapearse a los ids de demarcación existentes.
