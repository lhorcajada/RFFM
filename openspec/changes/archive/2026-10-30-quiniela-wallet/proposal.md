## Why

Hoy cada boleto de la quiniela se paga en mano o por Bizum y el entrenador lo marca como pagado a
mano, uno a uno. Muchos participantes pagan varias jornadas seguidas o por adelantado. Se quiere un
**Monedero** por equipo y usuario: el entrenador recarga saldo cuando cobra, y al guardar un boleto
el sistema lo cobra solo del saldo, sin que el entrenador tenga que marcar nada.

## What Changes

- **Backend (`Back/ExtractionApi`)**:
  - Nuevo monedero por (equipo, usuario) con saldo decimal nunca negativo y un libro de movimientos
    (recarga, ajuste, cobro de boleto, reembolso).
  - El entrenador recarga saldo (importe > 0), resta saldo con un ajuste (nunca deja el saldo en
    negativo) y consulta el saldo de los usuarios del equipo.
  - Cobro todo-o-nada al crear un boleto: si el saldo cubre el precio de la jornada, se descuenta y el
    boleto queda `Paid` con método `Wallet`; si no, queda `Pending` y el saldo no cambia. El `PUT` de un
    boleto pendiente también intenta cobrar. La respuesta avisa del cobro.
  - Acción explícita del participante «Pagar con monedero» para un boleto pendiente ya guardado.
  - Reembolso automático cuando se elimina (o se devuelve a pendiente) un boleto pagado con el
    monedero, incluido el reinicio de la jornada.
  - El participante puede borrar su propio boleto, también pagado, mientras los pronósticos sigan
    abiertos (antes del primer partido válido); si estaba pagado con monedero se reembolsa.
  - Concurrencia: dos guardados simultáneos no gastan el mismo saldo (token `xmin` + reintento).
  - **Versión**: API minor.
- **Frontend (Coach, `Front/`)**:
  - Participante: tarjeta «Monedero» con saldo e historial en la página de la quiniela y aviso al
    guardar un boleto cobrado del saldo.
  - Entrenador: página «Monederos» con tarjetas por usuario, recarga y ajuste.
  - Responsive, sin tablas. **Versión**: web minor.

## Capabilities

### New Capabilities
- `quiniela-wallet`: monedero de la quiniela por equipo y usuario.

### Modified Capabilities
- `quiniela-team-pool`: el pago de un boleto puede ser con monedero; deshacerlo reembolsa.

## Impact

- `Back/ExtractionApi`: nuevos `Features/Coaches/Quiniela/*Wallet*.cs`, entidades en
  `Domain/Entities/Teams/`, configuración EF, `QuinielaPaymentMethod.Wallet`, códigos de error,
  `PayQuinielaTicketWithWallet.cs`, cambios en `SaveQuinielaTicket`, `DeleteQuinielaTicket`,
  `DeleteMyQuinielaTicket`, `SetQuinielaTicketPayment`,
  `ResetQuiniela` y `QuinielaSupport`; migración en commit aparte.
- `Front/`: `quinielaService.ts`, `Quiniela.tsx` (botón «Pagar con monedero»), nueva `QuinielaWallets.tsx`, ruta y menú.
- **Fuera de alcance**: `Mobile/`, pasarela de pago online, monedero global entre equipos, retirada
  de saldo en efectivo, notificaciones push de movimientos.
