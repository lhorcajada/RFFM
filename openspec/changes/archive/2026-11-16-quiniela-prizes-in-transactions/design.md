## Context

Verified facts:
- `GetTeamTransactions.Handler.LoadWalletMovementsAsync` solo carga movimientos de monedero de tipo `TopUp` y `TicketCharge`; `WalletRow` los proyecta como `WalletTopUp` / `WalletCharge`.
- Los premios se abonan como `QuinielaWalletMovement` de tipo `Prize` (importe positivo, descripción `Premio jornada {n}`, `TicketId` informado) mediante `QuinielaSupport.CreditPrizesAsync`, tanto en la liquidación como en el abono retroactivo.
- El spec `team-transactions-list` excluye hoy de forma explícita los movimientos `Prize`.
- El Front tipa `TransactionType` como unión de cinco literales y etiqueta cada uno en `TransactionCard.tsx`; el filtro de tipos vive en `Transactions.tsx`.

Assumption: `Prize` no necesita estado pendiente; el movimiento solo existe una vez abonado.

## Goals / Non-Goals

Goals:
- Mostrar cada premio abonado al monedero como transacción identificada como «Premio de la quiniela».
- Poder filtrar por ese tipo y respetar la visibilidad existente (coach ve todo el equipo; resto, solo lo propio).

Non-goals:
- Listar premios aún no abonados (boletos premiados sin movimiento `Prize`).
- Listar `Adjustment`, `TicketRefund` o `Donation`.
- Migraciones, tablas o columnas nuevas; cambios en Mobile.

## Decisions

### D1. Tipo nuevo `QuinielaPrize` en lugar de reutilizar `Quiniela` o `WalletTopUp`

Se añade `QuinielaPrize` al enum `TransactionType`. Alternativas: reutilizar `Quiniela` (mezcla la entrada pagada con el premio y no se distingue ni se filtra) o `WalletTopUp` (etiqueta «Recarga», engañosa). Un tipo propio da etiqueta y filtro específicos con coste mínimo y cumple la petición de «indicar que es un premio de la quiniela». Cambio aditivo en el contrato.

### D2. Misma carga que los demás movimientos de monedero

`LoadWalletMovementsAsync` amplía el filtro a `Prize` y `WalletRow` mapea `Prize` → `QuinielaPrize` con prefijo de id `quiniela-prize:`. Se reutilizan la restricción por dueño del monedero y la carga de participantes, de modo que la visibilidad es idéntica a recargas y cobros. `wantsWallet` pasa a incluir `QuinielaPrize`. Importe `Math.Abs(Amount)`, estado `Paid`, sin importe pendiente, fecha `OccurredAt`.

### D3. Descripción

Se conserva `movement.Description` (`Premio jornada N…`) por informativa; `Label(QuinielaPrize)` = «Premio de la quiniela» cuando falta. La etiqueta de tipo de la tarjeta del Front también es «Premio de la quiniela», de forma que se identifica siempre aunque la descripción cambie.

### D4. Front

`TransactionType` añade `QuinielaPrize`; `TYPE_LABELS` añade «Premio de la quiniela»; `TYPE_FILTER_OPTIONS` añade «Premios». Sin cambios de layout (tarjetas ya responsive).

## Target State

La ventana de transacciones lista, junto a recargas y cobros, una tarjeta «Premio de la quiniela» por cada premio abonado, filtrable con `type=QuinielaPrize`, visible para su dueño y para el coach del equipo.

## Risks / Trade-offs

- Un cliente que haga `switch` exhaustivo sobre `type` podría no conocer el valor nuevo: el único cliente es el Front de este repo, que se actualiza en el mismo change; el Front debe degradar sin romper ante un tipo desconocido (`TYPE_LABELS[type]` devolvería `undefined`); se cubre con el tipado estricto y el test de la tarjeta.
- El importe se muestra positivo, igual que recargas; el signo se infiere del tipo. Aceptado por coherencia con el resto.

## Migration Plan

Not applicable: sin cambios de esquema ni de datos; los premios ya abonados aparecen automáticamente al desplegar porque se proyectan de movimientos existentes.

## Validation Strategy

- Integración (`GetTeamTransactionsHandlerTests`, BD real vía Testcontainers/Podman): un movimiento `Prize` produce una transacción `QuinielaPrize` `Paid` con importe, fecha, descripción y dueño correctos; sin descripción usa la etiqueta por defecto; `Adjustment`/`TicketRefund`/`Donation` siguen sin listarse; un jugador solo ve sus premios; el coach ve todos; `type=QuinielaPrize` filtra.
- Endpoint (`GetTeamTransactionsEndpointTests`): `type=QuinielaPrize` devuelve 200 y un valor desconocido sigue devolviendo 400.
- Front (Vitest): `TransactionCard` muestra «Premio de la quiniela» y «Pagado»; `Transactions` ofrece el filtro «Premios» y lo envía como `type`.

## ADR / DDR Evaluation

Neither: ampliación aditiva de una proyección de lectura sin decisión arquitectónica ni de dominio nueva. Routing guidance de ADR/DDR no disponible en el repo.

## Open Questions

None
