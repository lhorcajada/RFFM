## Why

La pantalla «Lotería» del Coach muestra el resumen como cuatro cifras iguales y los tacos como tarjetas con borde lateral de color:
no se ve de un vistazo cuánto se ha recogido ni cuánto falta. El rediseño de referencia está en `.design/coach-lottery` (móvil y escritorio).

## What Changes

- **Solo frontend (`Front/`)**, página `Lottery` y sus componentes; sin cambios de API ni backend.
  - **Resumen**: tarjeta principal con lo recogido, lo pendiente y una barra de progreso de tacos devueltos; debajo, tres cifras (papeletas vendidas, papeletas en la calle, tacos por devolver).
  - **Tacos**: estado «Por devolver» / «Devuelto» como etiqueta en la tarjeta, en lugar del borde lateral de color.
  - **Escritorio**: las tarjetas de jugadores se disponen en rejilla `auto-fill`; en móvil siguen apiladas.
- Se mantiene: textos («taco», «Entregar», «Devolver»…), búsqueda, filtros, hojas de entrega/devolución, entrega al club.
- **Versión**: web minor (1.81.0 → 1.82.0).

## Capabilities

### New Capabilities
- `lottery-redesign`: resumen con progreso de recogida y estado visible de cada taco.

## Impact

- `Front/src/apps/coach/pages/lottery/components/LotterySummary.tsx` + `.module.css`.
- `components/LotteryPlayerCard.tsx` + `.module.css`, `Lottery.module.css`.
- Tests: `components/__tests__/LotterySummary.test.tsx`, `LotteryPlayerCard.status.test.tsx`.
- `Front/package.json` (versión).
- **Fuera de alcance**: backend, hojas de entrega/devolución, diálogo de campaña, entrega al club.
