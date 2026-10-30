## 1. Backend: dominio del monedero (~2h)

- [x] Red: tests de dominio `QuinielaWallet` en `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/` (importe máximo 10,00 € (10,00 vale, 10,01 falla), `TopUp` suma y registra movimiento, importe 0/negativo/más de 2 decimales falla, `Adjust` dentro del saldo, `Adjust` por encima del saldo falla sin cambiar el saldo, `TryChargeTicket` con saldo suficiente / exacto / insuficiente (devuelve null y no cambia nada), `RefundTicket`, invariante `Balance == SUM(Amount)`) y de `QuinielaTicket.PaidFromWallet`.
- [x] Green: `QuinielaWallet`, `QuinielaWalletMovement`, SmartEnum `QuinielaWalletMovementType`, `QuinielaPaymentMethod.Wallet = 3`, `PaidFromWallet`, códigos de error en `Domain/ErrorCodes.cs` (D1).
- [x] Refactor: reglas de importe en `QuinielaWallet.Rules` (máximo por movimiento).
- **Aceptación**: escenarios «Top up», «Invalid amount», «Adjustment within/above the balance», «Enough/Exact/Insufficient balance», «No wallet» (a nivel de dominio) de `quiniela-wallet`.
- **Verify**: `dotnet build` + `dotnet test --filter Quiniela`.

## 2. Backend: persistencia y concurrencia (~2h)

- [x] Red: test de integración (PostgreSQL real, `IntegrationTests/`) de dos cargos simultáneos con saldo para uno (solo uno `Paid`, saldo 0) y de dos recargas simultáneas sobre un monedero inexistente (un único monedero, suma correcta).
- [x] Green: `QuinielaEntityConfiguration` (tablas `QuinielaWallets`/`QuinielaWalletMovements`, `xmin` como token, índice único `(TeamId, ApplicationUserId)`, índice por `TicketId`; el reembolso es idempotente por saldo neto del boleto, ver D5), `DbSet` en `AppDbContext`, helper de reintento (hasta 3 intentos con `ChangeTracker.Clear()`) en `QuinielaSupport` (D3, D7).
- [x] Migración con `.\manage-migrations.ps1`, **en commit aparte** del código de aplicación.
- **Aceptación**: escenarios «Two tickets, balance for one» y «Persistent conflict».
- **Verify**: `dotnet build` + `dotnet test --filter Quiniela`.

## 3. Backend: recarga, ajuste y consulta (~3h)

- [x] Red: validators y handlers de `TopUpQuinielaWallet`, `AdjustQuinielaWallet`, `GetQuinielaWallet`, `GetQuinielaWallets` (roles Coach/Player/Follower → 403, usuario fuera del equipo → 404, ajuste sin saldo → 409 ProblemDetails, paginación del historial, listado con saldo 0 para quien no tiene monedero, monedero propio vs. ajeno) + integración de los endpoints (401/403/404/409).
- [x] Green: cuatro ficheros `Features/Coaches/Quiniela/*.cs` (una feature = un `.cs`, `IFeatureModule`, `ICommand<T>`/`IQueryApp<T>`), validators registrados en `QuinielaSupport.AddQuinielaValidators`, `LoadParticipantsAsync` reutilizado (D6).
- **Aceptación**: «Each user has a wallet per team», «The coach tops up a wallet», «The coach subtracts balance with an adjustment», «The coach lists the wallets of the team», «A participant sees their own wallet».
- **Verify**: `dotnet build` + `dotnet test --filter Quiniela`.

## 4. Backend: cobro al guardar boleto (~3h)

- [x] Red: tests de `SaveQuinielaTicket` (POST con saldo suficiente/exacto/insuficiente/sin monedero; boleto rechazado no deja movimiento; PUT de pendiente tras recarga cobra una vez; PUT de `Paid` no cobra; PUT de `Expired` no cobra; `WalletCharge` en la respuesta y `null` si no se cobró).
- [x] Green: ampliar `SaveQuinielaTicket` (D2, D2b, D4) y `QuinielaTicketDto`/`QuinielaSupport.ToDto`; rechazo de `Wallet` en el validator de `SetQuinielaTicketPayment`.
- **Aceptación**: «Saving a new ticket charges the wallet all or nothing», «Editing a pending ticket also tries to charge the wallet».
- **Verify**: `dotnet build` + `dotnet test --filter Quiniela`.

## 4b. Backend: pago explícito con monedero (~2h)

- [x] Red: validator y handler de `PayQuinielaTicketWithWallet` (saldo suficiente -> `Paid`/`Wallet` + movimiento + `WalletCharge`; saldo insuficiente -> 409 `QuinielaWalletInsufficientBalance` y boleto `Pending`; `Paid` y `Expired` -> 409 `QuinielaTicketNotPayable`; pronósticos cerrados -> `QuinielaPicksClosed`; boleto ajeno -> 404; Follower -> 403) + integración de doble petición simultánea (un solo cobro).
- [x] Green: `Features/Coaches/Quiniela/PayQuinielaTicketWithWallet.cs`, validator registrado en `AddQuinielaValidators`, código `QuinielaTicketNotPayable` (D2c).
- **Aceptación**: «A participant pays a pending ticket from the wallet» (7 escenarios).
- **Verify**: `dotnet build` + `dotnet test --filter Quiniela`.

## 5. Backend: reembolsos y borrado propio (~3h)

- [x] Red: tests de `DeleteQuinielaTicket` (wallet → reembolsa y un solo `TicketRefund`; Cash/Bizum/pendiente → no toca monedero; jornada liquidada → rechaza), `ResetQuiniela` (reembolsa a cada dueño), `SetQuinielaTicketPayment` (wallet → pendiente reembolsa; `Wallet` como método manual → validación) y no reembolsar dos veces.
- [x] Red: tests de `DeleteMyQuinielaTicket` (borra pendiente/expirado sin tocar monedero; borra `Paid` con `Wallet` y reembolsa una vez; `Paid` Cash/Bizum -> 409 `QuinielaTicketPaidManually`, boleto intacto y sin tocar monedero; respuesta de éxito 204; pronósticos cerrados -> `QuinielaPicksClosed`; liquidada -> `QuinielaAlreadySettled`; boleto ajeno -> 404; doble borrado -> un solo reembolso).
- [x] Green: `DeleteMyQuinielaTicket` con `LoadRoundAsync` + `EnsurePicksOpen`, reembolso del boleto con monedero, rechazo de Cash/Bizum con `QuinielaTicketPaidManually` y respuesta 204 (D5b).
- [x] Green: `QuinielaSupport.RefundWalletTicketsAsync` (D5) y su uso en `DeleteQuinielaTicket`, `ResetQuiniela` y `SetQuinielaTicketPayment`; totales de `GetQuinielaPayments`/`GetCurrentQuiniela` cuentan el boleto con monedero como cobrado.
- [x] Subir la versión minor de la API en `Back/ExtractionApi/Directory.Build.props` (D9).
- **Aceptación**: «Deleting a wallet-paid ticket refunds the wallet», «A participant deletes their own ticket while picks are open» y, de `quiniela-team-pool`, «Wallet-paid ticket counts as collected», «Wallet-paid ticket back to pending», «Wallet is not a manual method».
- **Verify**: `dotnet build` + `dotnet test` (suite completa una sola vez, al terminar el bloque backend).

## 6. Frontend: servicio y monedero del participante (~3h)

- [x] Red: tests del botón «Pagar con monedero» (visible solo en pendiente no expirado con pronósticos abiertos, deshabilitado con motivo si falta saldo, éxito -> snackbar y boleto pagado, 409 -> snackbar de error y saldo refrescado) y del borrado propio (`ConfirmDialog` con aviso de reembolso en boletos pagados con monedero; la acción no se ofrece en boletos pagados en Cash/Bizum).
- [x] Red: `quinielaService.test.ts` (funciones de monedero, `payQuinielaTicketWithWallet` y `walletCharge`) y tests de `WalletCard`/`WalletMovementsDialog` (saldo, historial vacío, «Cargar más», signo por tipo) y de `Quiniela` (snackbar con importe y saldo al guardar con cobro; sin snackbar si no se cobró; «Pagado con monedero»).
- [x] Green: tipos y servicio en `quinielaService.ts`, botón «Pagar con monedero» y borrado de boleto con monedero en `Quiniela.tsx`/`TicketSummary`, `WalletCard.tsx`, `WalletMovementsDialog.tsx` (+ CSS Modules, mobile-first, tarjetas, sin tablas), integración en `Quiniela.tsx` y aviso vía `rffm.show_snackbar` (D8).
- **Aceptación**: «The wallet is shown in the quiniela pages» (`Pay button on pending tickets`, `Notice after saving`, `Participant history on mobile`).
- **Verify**: `npx vitest run src/apps/coach/pages/quiniela` (la suite completa y `npm run build` solo al final).

## 7. Frontend: monederos del entrenador (~2h)

- [x] Red: tests de `QuinielaWallets` (tarjeta por usuario con saldo, recarga válida/importe inválido, ajuste con `ConfirmDialog`, error 409 de saldo insuficiente con snackbar, inaccesible para no entrenador) y de `teamSections` (entrada «Monederos de la quiniela» solo no-jugador).
- [x] Green: `QuinielaWallets.tsx` + CSS Module, ruta lazy `quiniela/monederos` con `RequireFeaturePermission`, `teamNavRoutes.ts`, `teamSections.ts` (D8).
- [x] Subir la versión minor de la web con `npm version 1.98.0 --no-git-tag-version` en `Front/` (D9; comprobar la versión vigente).
- **Aceptación**: «Coach adjusts with confirmation» y «The coach lists the wallets of the team».
- **Verify**: tests del área; al final, una vez, `npx vitest run --maxWorkers=2` y `npm run build`.

## 7b. Frontend: saldo del monedero en la cabecera

- [x] Red: tests de `useQuinielaWalletBalance` (saldo, fallo silencioso, refresco por `rffm.quiniela_wallet_updated`), de `AppHeader` (monedero y hucha como botones distintos, oculto en federación/`hideIndicators`/hook no visible, navegación a `/coach/quiniela?teamId=`) y del despacho del evento en `Quiniela` y `QuinielaWallets`.
- [x] Green: hook `shared/hooks/useQuinielaWalletBalance.ts` (+ `resolveUserTeamId.ts` extraído de `useTeamFundBalance`), botón con `AccountBalanceWalletIcon` en `AppHeader` con tooltips «Mi monedero» / «Hucha del equipo» y estilo propio vía `--rffm-secondary` (CSS Module), y despacho del evento tras guardar con cobro, pagar con monedero, borrar con reembolso y recargar/ajustar.
- **Aceptación**: «The wallet balance is shown in the Coach app header».
- **Verify**: `npx vitest run src/shared/hooks src/shared/components/ui/AppHeader src/apps/coach/pages/quiniela`.

## 8. Cierre

- [x] `openspec validate quiniela-wallet --strict`.
- [ ] Comprobación visual a ~360 px y escritorio (monedero del participante y página del entrenador).
- [ ] Marcar en esta lista solo lo realmente hecho; commits (aplicación, migración, versión) tras confirmación del usuario.
