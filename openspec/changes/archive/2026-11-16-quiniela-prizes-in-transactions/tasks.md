## Planning Status

Plan derivado de `proposal.md`, `specs/team-transactions-list/spec.md` y `design.md`. Ningún paso está implementado ni verificado. Orden TDD: tests primero (Red), luego implementación mínima (Green).

## Step 1: Listar los premios del monedero como transacciones `QuinielaPrize` en la API

Trazabilidad: requisitos «Transaction sources and types», «Payment status…», «Transactions are ordered by date and filterable» y «Access is limited…».
- [x] 1.1 Red: tests en `GetTeamTransactionsHandlerTests` para `Prize` → `QuinielaPrize` (`Paid`, importe, fecha, descripción, dueño), descripción por defecto, exclusión de `Adjustment`/`TicketRefund`/`Donation`, visibilidad propia vs. coach y filtro `type=QuinielaPrize`.
- [x] 1.2 Red: test en `GetTeamTransactionsEndpointTests` de `type=QuinielaPrize` (200) y de valor desconocido (400).
- [x] 1.3 Green: añadir `QuinielaPrize` a `TransactionType`, incluir `Prize` en `LoadWalletMovementsAsync`, mapearlo en `WalletRow` (prefijo `quiniela-prize:`), ampliar `wantsWallet` y `Label`.
- [x] 1.4 Ejecutar solo los tests de `GetTeamTransactions*` y `dotnet build`.

## Step 2: Mostrar y filtrar el premio en la ventana de transacciones del Front

Trazabilidad: requisito «The coach app shows transactions in a responsive card list».
- [x] 2.1 Red: test de `TransactionCard` con tipo `QuinielaPrize` (etiqueta «Premio de la quiniela», estado «Pagado») y de `Transactions` con la opción de filtro «Premios».
- [x] 2.2 Green: ampliar `TransactionType` en `transactionService.ts`, `TYPE_LABELS` en `TransactionCard.tsx` y `TYPE_FILTER_OPTIONS` en `Transactions.tsx`.
- [x] 2.3 Ejecutar solo `npx vitest run src/apps/coach/pages/transactions`.

## Step 3: Verificación final y versionado

- [ ] 3.1 Ejecutar una sola vez `dotnet test`, `npx vitest run --maxWorkers=4` y `npm run build`.
- [x] 3.2 Subir minor en `Back/ExtractionApi/Directory.Build.props` y `Front/package.json` (feat), en el mismo commit del cambio.
- [ ] 3.3 Comprobación visual de la tarjeta y el filtro en móvil (~360 px) y escritorio.
