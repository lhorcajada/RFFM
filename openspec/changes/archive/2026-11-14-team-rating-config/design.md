## Context

Verified facts:
- Las 28 capacidades (campo y porteros, 10 textos de nivel cada una) viven solo en el frontend (`ratingConcepts.ts`). El backend guarda cada respuesta como `TeamPlayerRatingDetail` (clave, categoría, nivel, texto) y `CreateTeamRatingsBatch` no valida las claves contra ningún catálogo, así que una capacidad personalizada funciona sin tocar ese modelo.
- Los 12 rasgos tienen clave y fase en el backend (`TraitCatalog.cs`) y etiqueta y descriptores solo en el frontend (`ratingTraits.ts`). El backend usa `TraitCatalog.IsKnown` en `CreateTeamTraitRatings`, `SavePositionTraitWeights` y en `TeamPlayerTraitRatingLevel.Create`, y `DefaultTraitWeights.For` solo conoce las claves por defecto.
- `ratingSheet.ts` (`characteristicsFor`, `buildInitialDraft`, `planSave`) y las vistas de conducta (`TraitBoardView`, `TraitPlayerCard`, `useTraitRating`, `PositionWeightsEditor`) leen los catálogos estáticos. `NewRatingPage`, `RatingHistoryPage`, `RatingEvolutionPage`, `SubRatingsPanel` y `squadPdfExport` también importan `ratingConcepts`.
- `TeamEditAuthorization` y `TeamTraitRatingAccess` ya resuelven quién puede gestionar un equipo.

Assumptions:
- Una capacidad o rasgo creado por el equipo no necesita reordenarse en esta versión: va al final de su grupo.

## Goals / Non-Goals

Goals:
- Que cada equipo añada, edite y oculte capacidades y rasgos sin afectar a otros equipos y sin perder valoraciones.
- Que validación, encaje, pesos y propuesta de desconvocatoria usen los rasgos del equipo.

Non-goals:
- Crear o renombrar categorías de capacidades, reordenar elementos o cambiar las claves por defecto.
- Adaptar `NewRatingPage`, `RatingHistoryPage`, `RatingEvolutionPage`, `SubRatingsPanel` y `squadPdfExport` al catálogo del equipo.
- Borrado definitivo de elementos con historial.

## Decisions

### D1. Personalizaciones por equipo, no copia del catálogo
Dos tablas, `TeamCapacityDefinition` y `TeamTraitDefinition`, con una fila solo cuando el equipo personaliza un valor por defecto o crea uno propio: `TeamId`, `Key`, `IsCustom`, `IsHidden` y los textos editables como campos opcionales (`Label`, `LevelTexts` en las capacidades; `Label`, `Phase`, `Anchor1/3/5` en los rasgos). `Sheet` y `CategoryKey` solo se rellenan en las capacidades propias. Índice único (`TeamId`, `Key`). Alternativa descartada: copiar todo el catálogo a cada equipo, porque los cambios en los valores por defecto no llegarían a nadie. Consecuencia: un equipo sin filas ve exactamente los valores por defecto.

### D2. El cliente combina valores por defecto y personalizaciones
`GET .../rating-config` devuelve solo las personalizaciones; el cliente las combina con los textos por defecto que ya posee. El backend no tiene los textos por defecto de las capacidades y portarlos a C# duplicaría unos 28 × 10 textos sin que la validación los necesite. Por eso `PUT .../capacities/{key}` y `.../visibility` aceptan claves por defecto (se guardan como personalización) y reciben hoja y categoría; solo las claves `custom-` desconocidas dan 404.

### D3. El servidor resuelve las claves de rasgos válidas
Para validar y calcular, el backend resuelve el conjunto efectivo de claves de rasgos: las por defecto (de `TraitCatalog`) más las propias, menos las ocultas, con la fase que corresponda. `TeamPlayerTraitRatingLevel.Create` deja de exigir `TraitCatalog.IsKnown` y valida solo clave no vacía de hasta 50 caracteres y nivel 1–5, porque la comprobación contra el catálogo del equipo pasa al manejador (código `TraitNotInTeamCatalog`, 400). Las lecturas del historial no filtran por catálogo.

### D4. Claves estables de elementos propios
`custom-` más un GUID sin guiones (39 caracteres, dentro del límite de 50 de `TraitKey` y `CharacteristicKey`). La clave, la categoría y la hoja no cambian al editar.

### D5. Pesos y encaje con rasgos del equipo
`GetTeamPositionFit.ResolveWeights` parte de los pesos por defecto, añade los rasgos propios con peso «suma», descarta los ocultos y aplica las sobrescrituras del equipo. `SavePositionTraitWeights` deja de validar las claves en el validador (no tiene base de datos) y lo hace en el manejador contra el conjunto efectivo. La propuesta de desconvocatoria no cambia: consume el orden y el encaje ya calculados por el servidor.

### D6. Ocultar en lugar de borrar
`IsHidden` quita el elemento de la valoración nueva, de los pesos y del encaje, pero conserva los niveles guardados y permite restaurarlo. En la hoja de capacidad, una nueva valoración de un jugador solo incluye las capacidades visibles, así que las ocultas no cuentan en las medias por categoría de esa valoración; las valoraciones antiguas no se tocan.

### D7. Catálogo efectivo en el frontend
`useRatingConfig(teamId)` carga las personalizaciones, las combina con `ratingConcepts` y `ratingTraits` y devuelve capacidades de campo, capacidades de porteros, rasgos visibles y la lista completa (con ocultos) para la configuración. Si la lectura falla, devuelve los valores por defecto. `characteristicsFor`, `buildInitialDraft` y `planSave` reciben el catálogo como parámetro opcional con los valores por defecto como valor inicial, de modo que los tests y las pantallas no adaptadas siguen funcionando. Las vistas de conducta y de pesos reciben los rasgos por props.

### D8. Vista «Configurar»
Cuarta vista de `RatingViewSwitcher` (`view=config`) con pestañas «Capacidades» y «Rasgos», tarjetas en lista, diálogo de alta y edición (validación de textos obligatorios y longitudes), `ConfirmDialog` al ocultar y «Restaurar» en los ocultos. Para las capacidades, el selector de hoja y categoría solo aparece al crear.

## Target State

El entrenador abre «Configurar», añade un rasgo o una capacidad, edita textos o los oculta, y la hoja de capacidad, la valoración de conducta, los pesos y el orden por puesto del equipo reflejan el cambio al momento sin afectar a otros equipos ni al historial.

## Risks / Trade-offs

- Una capacidad nueva deja «incompletos» a los jugadores que el entrenador modifique hasta que se valore también la nueva: la hoja ya avisa de jugadores sin completar y no los guarda. Se mantiene el comportamiento actual y se documenta en el diseño de la interfaz.
- Cambiar el texto de un nivel no actualiza valoraciones guardadas (guardan su texto). Es intencionado: el historial refleja lo que se vio.
- Pantallas no adaptadas (historial, evolución, PDF) no mostrarán el nombre personalizado de una capacidad por defecto ni listarán las propias aunque estén guardadas en las valoraciones. Mitigación: queda como pregunta abierta y se puede abordar en un cambio posterior.
- Relajar la validación de `TeamPlayerTraitRatingLevel.Create` mueve la comprobación al manejador; los tests deben cubrir claves desconocidas, ocultas y propias.

## Migration Plan

Migración EF aditiva con dos tablas nuevas, sin backfill: un equipo sin filas ve los valores por defecto. Se genera en commit separado. Rollback: revertir la migración; no hay dependencias de otras tablas.

## Validation Strategy

- Backend (xUnit): resolución de claves efectivas (por defecto, propias, ocultas), validadores de alta y edición (longitudes, categoría, hoja, 10 textos, fase, descriptores), manejadores con Postgres (crear, editar, ocultar, restaurar, 404 para clave propia desconocida, 403 para jugador, familia y coach ajeno), `CreateTeamTraitRatings` con claves propias y ocultas, `SavePositionTraitWeights` y `GetTeamPositionFit` con rasgos propios (peso «suma») y ocultos ignorados.
- Frontend (Vitest): combinación de valores por defecto y personalizaciones, hook con fallback ante error, hoja de capacidad con capacidad propia y oculta, vistas de conducta y pesos con rasgos propios, vista «Configurar» (alta, edición, ocultar con confirmación, restaurar, solo lectura, 360 px).
- La suite completa se ejecuta una sola vez al terminar, con el `DOCKER_HOST` de Podman por TCP si el pipe no existe.

## ADR / DDR Evaluation

Ninguno: sigue las convenciones existentes (vertical slice, CQRS, CSS Modules). Si más adelante se mueven los valores por defecto de las capacidades al backend, esa decisión merecería un DDR.

## Open Questions

- ¿Adaptar historial, evolución, nueva valoración, panel de subvaloraciones y PDF al catálogo del equipo en un cambio posterior?
- ¿Permitir reordenar elementos y crear categorías propias?
- ¿Hace falta un límite de elementos propios por equipo? La v1 no lo impone.
