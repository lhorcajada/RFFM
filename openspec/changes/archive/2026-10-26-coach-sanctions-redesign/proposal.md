## Why

La pantalla «Sanciones» del Coach muestra tres tarjetas de totales iguales, filtros sin contadores y
tarjetas con acciones solo de icono. El rediseño de referencia está en `.design/sanctions`
(escritorio y móvil).

## What Changes

- **Solo frontend (`Front/`)**, página `Sanctions` y sus componentes; sin cambios de API ni backend.
  - **Resumen**: lo pendiente de cobro destacado, con barra de cobrado frente a multado; la bolsa del equipo aparte.
  - **Filtros**: Todas / Pendientes / Pagadas con el número de sanciones de cada grupo.
  - **Tarjetas**: bloque de dinero con barra de pago y acciones con texto (Editar, Levantar sanción, Eliminar) de ≥ 44 px; el énfasis de pendiente deja de usar borde lateral.
- Se mantiene: filtro «mis sanciones», diálogos de alta/edición, WhatsApp, deep-link `highlight`.
- **Versión**: web minor (1.78.0 → 1.79.0).

## Capabilities

### New Capabilities
- `coach-sanctions-redesign`: resumen con progreso de cobro, filtros con contadores y tarjetas con acciones etiquetadas.

## Impact

- `Front/src/apps/coach/pages/sanctions/Sanctions.tsx` + `.module.css`.
- `components/SanctionsSummaryCards.tsx`, `components/SanctionCard.tsx` y sus `.module.css`.
- Tests: `SanctionsSummaryCards.progress.test.tsx`, `SanctionCard.moneyAndActions.test.tsx`, `Sanctions.filterCounts.test.tsx`.
- `Front/package.json` (versión).
- **Fuera de alcance**: backend, diálogos de alta/edición, listado WhatsApp.
