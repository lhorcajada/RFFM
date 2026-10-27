## Context

`LotterySummary` pinta cuatro `Paper` iguales a partir de `LotteryTotals`; `LotteryPlayerCard` marca el estado del taco con `border-left`.

## Decisions

- **D1 · Tarjeta principal**: `LotterySummary` muestra «Recogido» (`amountCollected`), «pendiente» (`amountPending`) y un `role="progressbar"` con `aria-valuenow` = % de `booksReturned / booksDelivered` (0 si no hay tacos entregados). Sin props nuevos.
- **D2 · Cifras secundarias**: «Papeletas vendidas», «Papeletas en la calle» y «Tacos devueltos» (`devueltos/entregados`, hint «N por devolver»). El `data-testid="lottery-summary"` se conserva.
- **D3 · Estado del taco**: etiqueta (`Chip` pequeño) «Por devolver» (warning) o «Devuelto» (success) dentro de `.book`; el botón «Devolver» y el icono «Devuelto» (aria-label) no cambian. La etiqueta no es un botón, así que no interfiere con los filtros `button /por devolver/`.
- **D4 · Rejilla**: `.list` con `grid-template-columns: repeat(auto-fill, minmax(320px, 1fr))` y `.content` sin `max-width` (ocupa todo el ancho).
- **D5 · Estilo**: solo CSS Modules y tokens existentes; sin `border-left`, sin tablas.

## Risks

- Tests existentes buscan botones por nombre: se conservan los nombres accesibles.
