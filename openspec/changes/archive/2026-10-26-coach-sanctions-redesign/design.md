## Context

`Sanctions` pinta `SanctionsSummaryCards`, un filtro de estado y una lista de `SanctionCard`.

## Decisions

- **D1 · Resumen**: `SanctionsSummaryCards` conserva sus etiquetas («Total multado», «Total pendiente», «Bolsa del equipo») y añade
  bajo «Total pendiente» una barra (`role="progressbar"`) con lo cobrado = `max(totalFine − totalPending, 0)` y el texto «X € cobrados de Y €». Sin props nuevas.
- **D2 · Filtros**: el contador va en un `<span aria-hidden>` dentro del botón para que el nombre accesible siga siendo «Todas», «Pendientes», «Pagadas». Cuentan sobre las filas visibles según «mis/todas», antes del filtro de estado.
- **D3 · Tarjeta**: bloque de dinero con barra de pago (`progressbar`, `aria-valuenow` = % pagado) y «Pendiente X €»; botones `Button` con texto y `minHeight: 44px`. Nombres accesibles sin cambios.
- **D4 · Estilo**: se elimina `border-left` del énfasis pendiente; borde completo en tono de error. Solo tokens `--rffm-*` existentes; responsive con la rejilla `auto-fill` actual.

## Risks

- Tests existentes buscan botones por nombre exacto: se conservan.
