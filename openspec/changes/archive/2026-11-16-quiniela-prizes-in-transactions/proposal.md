## Why

Issue #16: cuando una quiniela se liquida, el premio se abona al monedero del ganador (`QuinielaWalletMovement` de tipo `Prize`), pero la ventana de transacciones del equipo no lo muestra porque solo lista recargas y cobros del monedero. El participante y el entrenador no ven en ningún sitio que ese ingreso es un premio de la quiniela.

## What Changes

- `GET /api/catalog/team/{teamId}/transactions` incluye cada movimiento de monedero de tipo `Prize` como una transacción nueva de tipo `QuinielaPrize`, con estado `Paid`, el importe del premio, la fecha del movimiento y el dueño del monedero como persona.
- El filtro `type` acepta el nuevo valor `QuinielaPrize`.
- La descripción de la transacción conserva el texto del movimiento (`Premio jornada N`, con el sufijo ` (abono retroactivo)` si lo hubo) y, si falta, usa la etiqueta `Premio de la quiniela`.
- La tarjeta de transacción del Front muestra la etiqueta `Premio de la quiniela` para el nuevo tipo, y el filtro de tipos añade la opción `Premios`.
- Sin migraciones ni tablas nuevas: se proyecta desde datos existentes.
- Visibilidad igual que el resto de movimientos del monedero: el entrenador ve los de todo el equipo; el resto de roles, solo los propios.

## Capabilities

### New Capabilities

### Modified Capabilities
- `team-transactions-list`: los movimientos de monedero de tipo `Prize` dejan de excluirse y se listan como transacciones `QuinielaPrize`; el filtro `type` admite ese valor.

## Impact

- Back: `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Teams/Queries/GetTeamTransactions.cs` (enum `TransactionType`, carga de movimientos de monedero, `WalletRow`, `Label`) y sus tests (`GetTeamTransactionsHandlerTests`, `GetTeamTransactionsEndpointTests`).
- Front: `Front/src/apps/coach/services/transactionService.ts` (tipo `TransactionType`), `pages/transactions/components/TransactionCard.tsx` (etiqueta), `pages/transactions/Transactions.tsx` (opción de filtro) y sus tests.
- Contrato de API: valor nuevo en `type` (aditivo, no rompe a clientes existentes que lo ignoren). Mobile no consume este endpoint.
- Versionado: `feat` sube minor en API y Web.

## Proposal Research Documentation

**Local files**:
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Teams/Queries/GetTeamTransactions.cs
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Quiniela/CreditQuinielaPrizes.cs
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Quiniela/QuinielaSupport.cs
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/Teams/QuinielaWalletMovement.cs
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/Teams/QuinielaEnums.cs
- Front/src/apps/coach/services/transactionService.ts
- Front/src/apps/coach/pages/transactions/Transactions.tsx
- Front/src/apps/coach/pages/transactions/components/TransactionCard.tsx
- openspec/specs/team-transactions-list/spec.md

**External URLs**:
- https://github.com/lhorcajada/RFFM/issues/16

## Request Additional Notes

## Additional Notes

- El premio se abona al monedero en la liquidación (`SettleQuiniela`) o con el abono retroactivo (`CreditQuinielaPrizes`), siempre vía `QuinielaSupport.CreditPrizesAsync` → `wallet.CreditPrize`, que crea el movimiento `Prize` con descripción `Premio jornada {n}`.
- Los boletos premiados no se listan hoy como premio: la transacción `Quiniela` de un boleto es el pago de la entrada, no el premio.
