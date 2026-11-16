## Step 1: Listar los premios del monedero como transacciones `QuinielaPrize` en la API

**Public interfaces**

`GET /api/catalog/team/{teamId}/transactions?type=QuinielaPrize` (ruta existente; valor nuevo en `type`).

```csharp
public enum TransactionType { Sanction, Lottery, Quiniela, WalletTopUp, WalletCharge, QuinielaPrize }
```

La forma de `TeamTransactionDto` no cambia: `type = "QuinielaPrize"`, `status = "Paid"`, `pendingAmount = null`, `id = "quiniela-prize:{movementId}"`.

**Spec-anchored test assertions**

- «Quiniela prize is listed as a quiniela prize transaction»: un movimiento `Prize` de 25 con descripción «Premio jornada 7» produce un item `QuinielaPrize`, `amount == 25`, `date == OccurredAt`, `description == "Premio jornada 7"`, `personName` = dueño del monedero.
- «Quiniela prize without a description uses the default label»: `description == "Premio de la quiniela"`.
- «Quiniela prize is always paid»: `status == "Paid"` y `pendingAmount == null`.
- «Wallet movements other than top-ups, charges and prizes are not listed»: `Adjustment`, `TicketRefund` y `Donation` no aparecen.
- «Filter by quiniela prize type»: `type=QuinielaPrize` devuelve solo ese tipo; `type=Desconocido` devuelve 400 `ProblemDetails`.
- «Player sees only their own quiniela prizes»: un jugador recibe solo su premio; el coach recibe los de todos.

## Step 2: Mostrar y filtrar el premio en la ventana de transacciones del Front

**Public interfaces**

```ts
export type TransactionType =
  "Sanction" | "Lottery" | "Quiniela" | "WalletTopUp" | "WalletCharge" | "QuinielaPrize";
```

**Spec-anchored test assertions**

- «Quiniela prize card is labelled as a quiniela prize»: la tarjeta de un `QuinielaPrize` muestra «Premio de la quiniela» y «Pagado».
- «Prize type filter narrows the cards»: elegir «Premios» llama a `getTeamTransactions` con `type: "QuinielaPrize"` y solo se ven tarjetas de premio.

## Step 3: Verificación final y versionado

None: sin contratos públicos adicionales.

**Spec-anchored test assertions**

Suite completa de API y Web en verde y `npm run build` correcto.
