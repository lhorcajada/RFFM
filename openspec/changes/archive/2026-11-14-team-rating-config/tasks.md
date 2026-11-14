## Planning Status

Plan basado en `proposal.md`, los specs de `team-rating-config`, `player-behavior-traits-rating`, `position-fit-ranking` y `squad-rating-sheets`, y `design.md`. Ninguna tarea está hecha. Cada paso sigue TDD (test primero) y ejecuta solo los tests del área afectada; la suite completa se lanza una vez al terminar.

## Step 1: Catálogo efectivo de rasgos en el backend

Cubre: Effective catalog per team, Behavior trait catalog (modificado).
- [x] 1.1 Tests del resolutor de claves efectivas de rasgos: por defecto, propias, ocultas, fase sobrescrita.
- [x] 1.2 Tests de `TeamPlayerTraitRatingLevel.Create`: acepta claves propias, rechaza vacías, de más de 50 caracteres o con nivel fuera de 1–5.
- [x] 1.3 Implementar entidades `TeamTraitDefinition` y `TeamCapacityDefinition`, el resolutor y la relajación de `Create`.

## Step 2: Endpoints de configuración

Cubre: Read the rating configuration, Create a capacity, Edit a capacity, Hide and restore a capacity, Create a trait, Edit, hide and restore a trait, Configuration endpoints and authorization.
- [x] 2.1 Tests de validadores de alta y edición de capacidades y rasgos (longitudes, categoría, hoja, 10 textos, fase, descriptores).
- [x] 2.2 Tests funcionales con Postgres de `GET rating-config` y de los manejadores de crear, editar y ocultar/restaurar (404 para clave propia desconocida, clave por defecto como personalización, 403 para jugador, familia y coach ajeno).
- [x] 2.3 Configuración EF, `DbSet`, slices `GetTeamRatingConfig`, `SaveTeamCapacity`, `SaveTeamTrait` y `SetRatingElementVisibility`, y migración EF en commit separado.

## Step 3: Rasgos del equipo en valoración, pesos y encaje

Cubre: Trait rating endpoints and authorization (modificado), Trait weights per position (modificado).
- [x] 3.1 Tests de `CreateTeamTraitRatings`: acepta rasgo propio, rechaza desconocido y oculto con `TraitNotInTeamCatalog`, el GET conserva niveles de rasgos ocultos.
- [x] 3.2 Tests de `SavePositionTraitWeights` y `GetTeamPositionFit`: rasgo propio con peso «suma», oculto ignorado y no listado en los pesos, sobrescrituras del equipo.
- [x] 3.3 Mover la validación de claves a los manejadores y aplicar el catálogo efectivo en el cálculo de pesos.

## Step 4: Catálogo efectivo en el frontend

Cubre: Effective catalog per team (cliente), Access to trait rating and position order (modificado).
- [x] 4.1 Tests de `ratingConfigService` y de la función que combina valores por defecto y personalizaciones (capacidades de campo y porteros, rasgos, ocultos).
- [x] 4.2 Tests de `useRatingConfig`: carga, fallback a valores por defecto si falla, recarga tras guardar.
- [x] 4.3 Implementar servicio, tipos, combinación y hook.
- [x] 4.4 Tests y cambios para que `ratingSheet.ts` y la hoja de capacidad usen las capacidades efectivas (propia visible, oculta no listada) conservando los valores por defecto como parámetro inicial.
- [x] 4.5 Tests y cambios para que `TraitBoardView`, `TraitPlayerCard`, `useTraitRating`, `PositionWeightsEditor` y `PositionFitPage` reciban los rasgos del equipo por props.

## Step 5: Vista «Configurar»

Cubre: Configure view, Access to trait rating and position order (cuarta vista).
- [x] 5.1 Tests de `RatingViewSwitcher` y de `RatingSheetPage` con la cuarta vista `view=config`.
- [x] 5.2 Tests de la vista de configuración: pestañas, tarjetas con marcas de oculto y propio, alta, edición, ocultar con confirmación, restaurar, validación del formulario, solo lectura.
- [x] 5.3 Implementar `RatingConfigPage`, la lista de tarjetas y el diálogo de edición de capacidades y de rasgos con CSS Modules responsive.

## Step 6: Cierre

- [x] 6.1 Subir versión minor en `Front/package.json` y `Back/ExtractionApi/Directory.Build.props`.
- [ ] 6.2 Ejecutar una sola vez la suite completa de Front y Back y `npm run build` / `dotnet build`.
- [x] 6.3 Comprobación visual en móvil (360 px) y escritorio de la vista «Configurar» y de las vistas adaptadas.
- [x] 6.4 `openspec validate team-rating-config --strict` y archivado al hacer commit y push.
