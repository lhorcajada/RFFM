## Why

Las capacidades de la hoja «Capacidad» y los rasgos de «Conducta en partido» están fijos en el código, y cada cuerpo técnico necesita adaptarlos a su modelo de juego: añadir los que le faltan, corregir textos y quitar los que no usa sin perder las valoraciones ya guardadas.

## What Changes

- Configuración por equipo de **capacidades** (campo y porteros) y de **rasgos**: añadir, editar y eliminar. Cada equipo parte de los valores por defecto actuales y los cambios no afectan a otros equipos.
- «Eliminar» oculta el elemento y conserva el historial; se puede restaurar. Vale para los valores por defecto y para los creados por el equipo.
- Capacidades: se editan la etiqueta y los 10 textos de nivel; la categoría (una de las 4 existentes) y la hoja (campo o porteros) se eligen al crear y no cambian después.
- Rasgos: se editan la etiqueta, la fase y los descriptores de los niveles 1, 3 y 5. Los nuevos rasgos entran con peso «suma» en todos los puestos hasta que el entrenador lo cambie.
- Nueva vista «Configurar» en `/coach/squad/rating-sheet` con pestañas «Capacidades» y «Rasgos».
- La hoja de capacidad, la valoración de conducta, el orden por puesto, los pesos y la propuesta de desconvocatoria usan el catálogo efectivo del equipo en vez del catálogo fijo, que pasa a ser los valores por defecto.
- La validación de rasgos deja de usar el catálogo fijo y usa el del equipo: los ocultos se rechazan en valoraciones nuevas, pero no rompen la lectura del historial.
- Sin cambios incompatibles.

## Capabilities

### New Capabilities
- `team-rating-config`: catálogo efectivo por equipo de capacidades y rasgos (valores por defecto, personalizados y ocultos), endpoints de configuración y vista «Configurar».

### Modified Capabilities
- `player-behavior-traits-rating`: el catálogo de rasgos deja de ser único y fijo y pasa a ser el del equipo; la validación de claves usa ese catálogo.
- `position-fit-ranking`: los pesos y el encaje consideran los rasgos del equipo (ocultos ignorados, nuevos con peso «suma»).
- `squad-rating-sheets`: la página ofrece una cuarta vista «Configurar» y la hoja de capacidad muestra las capacidades efectivas del equipo.

## Impact

- Backend: dos tablas nuevas de personalizaciones por equipo (`TeamCapacityDefinition`, `TeamTraitDefinition`) con migración, endpoints de configuración, y cambios en `CreateTeamTraitRatings`, `SavePositionTraitWeights` y `GetTeamPositionFit`.
- Frontend: `ratingConcepts.ts` y `ratingTraits.ts` pasan a ser valores por defecto; nuevo `useRatingConfig`; cambios en `RatingSheetPage`, las vistas de conducta, `PositionFitPage` y `deconvokeProposal`; nueva vista de configuración.
- Datos: las valoraciones existentes guardan clave, categoría, nivel y texto, así que las capacidades personalizadas no requieren cambios en ese modelo.
- Versionado: `feat` en Front y API (minor).

## Proposal Research Documentation

**Local files**:
- Front/src/apps/coach/pages/squad/rating/ratingConcepts.ts
- Front/src/apps/coach/pages/squad/rating/ratingTraits.ts
- Front/src/apps/coach/pages/squad/rating/RatingSheetPage.tsx
- Front/src/apps/coach/pages/squad/rating/TraitRatingPage.tsx
- Front/src/apps/coach/pages/squad/rating/PositionFitPage.tsx
- Front/src/apps/coach/pages/convocations/utils/deconvokeProposal.ts
- Back/ExtractionApi/src/RFFM.Api/Domain/PositionFit/TraitCatalog.cs
- Back/ExtractionApi/src/RFFM.Api/Domain/PositionFit/PositionFitCalculator.cs
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/TeamPlayers/TeamPlayerRating.cs
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Players/Commands/CreateTeamTraitRatings.cs
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Players/Commands/SavePositionTraitWeights.cs
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Players/Commands/CreateTeamRatingsBatch.cs
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Players/Queries/GetTeamPositionFit.cs
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Players/TeamTraitRatingAccess.cs
- openspec/specs/squad-rating-sheets/spec.md
- openspec/specs/player-behavior-traits-rating/spec.md
- openspec/specs/position-fit-ranking/spec.md

**External URLs**:
- (ninguna)

## Additional Notes

- `ratingConcepts` y `ratingTraits` también los importan `NewRatingPage`, `RatingHistoryPage`, `RatingEvolutionPage`, `SubRatingsPanel` y `squadPdfExport`; en esta versión siguen usando el catálogo por defecto más los textos guardados en cada valoración (ver preguntas abiertas en el diseño).
