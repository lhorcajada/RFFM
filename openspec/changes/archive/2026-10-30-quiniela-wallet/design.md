## Context

La quiniela del equipo (`quiniela-team-pool`, archivada) vive en `Features/Coaches/Quiniela/*.cs`
(vertical slice, una feature = un fichero) sobre `AppDbContext` (esquema `app`). Un boleto
(`QuinielaTicket`) tiene `PaymentStatus` (Pending/Paid; Expired es derivado), `PaymentMethod`
(`Cash`, `Bizum`) y `PaidAt`. El entrenador lo marca pagado con `SetQuinielaTicketPayment`.

Hallazgos del código que condicionan el diseño:

- **Precio**: no está en `QuinielaTeamSettings` (solo tiene `FundPercent`). Es un campo de la jornada,
  `QuinielaJornada.Price`, fijado al abrir con la constante `OpenQuiniela.TicketPrice = 1m`. El cobro
  usa `jornada.Price`; **no se añade precio a los ajustes** (sería otro cambio).
- `SaveQuinielaTicket` (POST crea / PUT reemplaza picks) ya hace un único `SaveChangesAsync`, así que
  boleto + cobro caben en una transacción implícita.
- `DeleteQuinielaTicket` (entrenador, cualquier boleto) y `ResetQuiniela` (borra jornada y todos sus
  boletos, sin pasar por el borrado de boleto) eliminan boletos pagados: ambos deben reembolsar.
- `DeleteMyQuinielaTicket` hoy solo permite borrar boletos `Pending` (`QuinielaTicketNotDeletable`) y no
  comprueba el cierre de pronósticos. Cambia (D5b).
- Los validadores se registran explícitamente en `QuinielaSupport.AddQuinielaValidators` (el proyecto
  no escanea el ensamblado).
- No hay uso previo de tokens de concurrencia (`xmin`/`IsRowVersion`) en `Infrastructure/Persistence`.
- Usuario e `Identity` viven en otro DbContext: sin FK a `ApplicationUserId` (patrón de `QuinielaTicket`).

## Goals / Non-Goals

**Goals**: monedero por (equipo, usuario) con saldo ≥ 0; recarga y ajuste del entrenador; cobro
todo-o-nada al guardar boleto; reembolso al eliminar; historial; sin doble gasto concurrente.

**Non-Goals**: ver «Fuera de alcance» de `proposal.md`. Además: el saldo del monedero **no** es
parte del fondo del equipo (`TeamFundMovement`); es dinero en custodia del entrenador y solo se
convierte en «cobrado» de la quiniela cuando paga un boleto.

## Decisions

**D1. Modelo de dominio** (`Domain/Entities/Teams/`).
- `QuinielaWallet : BaseEntity, IAggregateRoot`: `TeamId`, `ApplicationUserId`, `Balance`
  (`decimal(10,2)`), `UpdatedAt`, `Version` (xmin). Los movimientos no son una colección del agregado: cada método devuelve el `QuinielaWalletMovement` creado y el handler lo añade a `db.QuinielaWalletMovements` (evita que EF lo trate como modificado por tener `Id` asignado en cliente).
  Métodos con intención y las invariantes dentro de la entidad (no en handlers):
  `TopUp(amount, createdBy, description)`, `Adjust(amount, createdBy, reason)`,
  `TryChargeTicket(ticketId, price)` → `QuinielaWalletMovement?` (null si el saldo no alcanza, sin
  tocar nada), `RefundTicket(ticketId, amount)`. `TopUp/Adjust/Refund` validan importe > 0 y ≤ 2
  decimales; `Adjust` lanza `DomainException` `QuinielaWalletInsufficientBalance` si dejaría saldo < 0.
  Fábrica `QuinielaWallet.Create(teamId, userId)` con saldo 0.
- `QuinielaWalletMovement : BaseEntity`: `WalletId`, `Amount` (con signo, `decimal(10,2)`),
  `Type` (SmartEnum `QuinielaWalletMovementType`: `TopUp=1`, `Adjustment=2`, `TicketCharge=3`,
  `TicketRefund=4`), `OccurredAt` (UTC), `Description?` (≤ 200), `TicketId?` (sin FK: el boleto puede
  desaparecer y el historial se conserva), `CreatedByUserId?`. Libro **append-only**: nunca se edita
  ni se borra. Invariante: `Balance == SUM(Amount)` de sus movimientos.
- Se guarda el saldo (no solo se deriva con `SUM`) porque es lo que lleva el token de concurrencia (D3)
  y evita agregar el libro en cada guardado de boleto.
- `QuinielaPaymentMethod.Wallet = 3` (SmartEnum existente, valor nuevo; no requiere cambio de esquema
  porque se guarda como `int`). `QuinielaTicket.MarkPaid(QuinielaPaymentMethod.Wallet, now)` ya
  funciona; se añade `bool PaidFromWallet => PaymentMethod == Wallet && PaymentStatus == Paid`.
- Los métodos manuales del entrenador siguen siendo Cash/Bizum: el validador de
  `SetQuinielaTicketPayment` rechaza `Wallet` (hoy ya solo acepta nombres válidos; se excluye `Wallet`).

**D2. Cobro todo-o-nada al guardar boleto** (`SaveQuinielaTicket`, ampliado).
Tras construir/reemplazar el boleto, y solo si `ticket.PaymentStatus == Pending` y su estado efectivo
no es `Expired`:
1. Cargar el monedero (equipo, usuario) con tracking. Si no existe → no se cobra, no se crea monedero.
2. `wallet.TryChargeTicket(ticket.Id, jornada.Price)`: si `Balance >= Price` resta, crea el movimiento
   `TicketCharge` (importe negativo) y devuelve el movimiento; si no, devuelve null y no cambia nada.
3. Si cobró: `ticket.MarkPaid(Wallet, now)`.
4. Un único `SaveChangesAsync` persiste boleto, picks, saldo y movimiento (atómico).
Nunca hay cobro parcial. Un `Paid` (Cash/Bizum/Wallet) no se vuelve a cobrar. El precio sale de
`jornada.Price`, no de una constante.

**D2b. El PUT de un boleto Pendiente también intenta cobrar (decisión confirmada: sí).**
Justificación: un participante puede guardar con saldo 0, recargarle el entrenador y volver a guardar;
sin esto, el único camino sería que el entrenador marque a mano, que es justo lo que se quiere evitar,
y no hay otra acción de usuario que dispare el cobro. Restricciones: no se cobra si el boleto ya está
`Paid` (sin doble cobro) ni si está `Expired` (pagarlo lo reactivaría tras el plazo; para eso el
entrenador marca el pago a mano). Es un efecto implícito del guardado y el aviso en la respuesta (D4)
lo hace visible. **Un boleto `Expired` nunca se paga con monedero** (decisión del usuario), ni en el
PUT ni en la acción explícita de D2c.

**D2c. Acción explícita «Pagar con monedero»** (`PayQuinielaTicketWithWallet.cs`, `ICommand<QuinielaTicketDto>`,
`POST /api/teams/{teamId}/quiniela/{jornadaId}/my-tickets/{ticketId}/wallet-payment`, sin cuerpo,
`ParticipantRoles`, solo sobre un boleto propio). Flujo: cargar jornada y ronda, `EnsurePicksOpen`
(los pronósticos deben seguir abiertos: pagar tras el primer partido válido se rechaza con
`QuinielaPicksClosed`); el boleto debe estar `Pending` y no `Expired` (si no, 409
`QuinielaTicketNotPayable`); `TryChargeTicket`; si cobra, `MarkPaid(Wallet, now)` y movimiento en un
único `SaveChangesAsync` (con el mismo bucle de reintentos de D3). **Saldo insuficiente -> 409
ProblemDetails `QuinielaWalletInsufficientBalance`** con el saldo y el precio en el detalle, y el boleto
sigue `Pending` sin cambios. Es lo más coherente: a diferencia del guardado (donde pagar es un efecto
secundario oportunista y el boleto debe poder guardarse igual), aquí el cobro es la única finalidad de la
petición, y un 200 sin cobrar sería engañoso. Devuelve `QuinielaTicketDto` con `WalletCharge`.

**D3. Concurrencia.**
- `QuinielaWallet` lleva un token de concurrencia optimista sobre `xmin` de PostgreSQL: propiedad
  `uint Version` mapeada con `builder.Property(w => w.Version).HasColumnName("xmin").HasColumnType("xid")
  .ValueGeneratedOnAddOrUpdate().IsConcurrencyToken()` (sin columna física nueva). Cualquier cambio de
  saldo con un `Balance` ya modificado por otra transacción lanza `DbUpdateConcurrencyException`.
- Unicidad: índice único `(TeamId, ApplicationUserId)` en `QuinielaWallets`, para que dos recargas
  simultáneas sobre un monedero inexistente no lo dupliquen (la perdedora falla con `DbUpdateException`
  y se reintenta).
- El handler envuelve la unidad de trabajo en un bucle de **hasta 3 intentos**: ante
  `DbUpdateConcurrencyException`/violación del índice único, `db.ChangeTracker.Clear()` y se repite
  todo (recargar monedero y boleto). Así la perdedora re-evalúa con el saldo nuevo y, si ya no alcanza,
  el boleto queda `Pending` (escenario «Two tickets, balance for one»). Agotados los intentos →
  `ConflictException`/`DomainException` `QuinielaWalletConcurrency` (409 ProblemDetails) y no se cobra.
- Alternativa descartada: `SELECT … FOR UPDATE` en transacción explícita; añade SQL crudo y bloqueos
  largos sin necesidad para este volumen. Otra descartada: `UPDATE … SET Balance = Balance - x WHERE
  Balance >= x` (atómico pero fuera del modelo de dominio y del libro).
- Se aplica el mismo patrón a recarga, ajuste, reembolso y borrado, que también tocan el saldo.

**D4. Aviso en la respuesta.** `QuinielaTicketDto` (respuesta de POST/PUT de `SaveQuinielaTicket`)
gana un campo opcional `WalletCharge` (`QuinielaWalletChargeDto(decimal Amount, decimal BalanceAfter)?`),
`null` si no se cobró. Es aditivo: no rompe a los clientes actuales. El front ya recibe
`paymentMethod`/`paymentStatus` del boleto.

**D5. Reembolso.** Un único método de apoyo en `QuinielaSupport`, `RefundWalletTicketsAsync(db, tickets)`:
- Para cada boleto con `PaidFromWallet`, localiza su movimiento `TicketCharge` (por `TicketId`) y
  abona `ABS(Amount)` (lo realmente cobrado, no el precio actual) con `RefundTicket`.
- Idempotente: reembolsa el **saldo neto** cobrado por el boleto (`-SUM(Amount)` de sus movimientos), y solo si es
  > 0 y el boleto sigue `PaidFromWallet`; tras reembolsar, el boleto deja de estar pagado o desaparece.
  No hay índice único de reembolso porque un boleto puede cobrarse, devolverse y volver a cobrarse (el entrenador lo pone
  en pendiente y el participante lo vuelve a guardar con saldo); los doble envíos concurrentes los resuelve el token xmin.
- Se llama desde: `DeleteQuinielaTicket` (antes de `Remove`), `ResetQuiniela` (sobre todos los boletos
  de la jornada, antes de `RemoveRange`) y `SetQuinielaTicketPayment` (cuando un boleto `PaidFromWallet`
  pasa a Pending o a Paid con otro método: `MarkPending`/`MarkPaid` ya limpian método y fecha, y se
  reembolsa para que el dinero no desaparezca).
- No se reembolsa si la jornada está `Settled`: esos endpoints ya la rechazan.

**D5b. El participante borra su propio boleto (pendiente o pagado con monedero)** (`DeleteMyQuinielaTicket`, decisión del
usuario). Se amplía la restricción «solo pendientes» a «pendientes y pagados con monedero» y se añade la regla de cierre ya existente:
se carga la ronda con `QuinielaSupport.LoadRoundAsync` y se llama a `jornada.EnsurePicksOpen(
round.FirstValidKickoffUtc, now)`; tras el primer partido válido se rechaza con `QuinielaPicksClosed`
(y `Settled` sigue rechazando con `QuinielaAlreadySettled`). Según el boleto:
- `Pending` o `Expired`: se borra sin más (nunca se cobró).
- `Paid` con `Wallet`: se reembolsa lo cobrado con `RefundWalletTicketsAsync` y se borra, en un único
  `SaveChangesAsync`.
- `Paid` con `Cash`/`Bizum`: **el participante no puede borrarlo** (decisión del usuario). El dinero se
  entregó en mano o por Bizum y solo el entrenador puede devolverlo, así que borra el boleto él
  (`DeleteQuinielaTicket`). `DeleteMyQuinielaTicket` lo rechaza con ProblemDetails 409 y el código propio
  `QuinielaTicketPaidManually`, sin tocar ningún saldo. La respuesta de éxito sigue siendo 204; no hay
  aviso ni listado de «devoluciones pendientes».
- Ya no se usa `QuinielaTicketNotDeletable` para esta ruta (se sustituye por el código anterior).
- El front muestra «Borrar» solo en boletos pendientes/expirados y en los pagados con monedero (con
  `ConfirmDialog` que avisa del reembolso al monedero); en los pagados en mano/Bizum no se ofrece y se
  indica que debe pedirlo al entrenador.

**D6. API** (base `/api/teams/{teamId}/quiniela`, `RequireAuthorization()`, errores ProblemDetails,
todos los `ICommand` con `Validator` registrado en `AddQuinielaValidators`). Una feature = un `.cs`:

| Fichero (`Features/Coaches/Quiniela/`) | Ruta | Rol |
|---|---|---|
| `GetQuinielaWallet.cs` (IQueryApp, dos rutas) | `GET …/wallet?limit=25&offset=0` (propio) y `GET …/wallets/{userId}?limit&offset` | Participante / Coach |
| `GetQuinielaWallets.cs` (IQueryApp) | `GET …/wallets` | Coach |
| `PayQuinielaTicketWithWallet.cs` (ICommand<T>) | `POST …/{jornadaId}/my-tickets/{ticketId}/wallet-payment` -> 200 `QuinielaTicketDto` | Participante (boleto propio) |
| `TopUpQuinielaWallet.cs` (ICommand<T>) | `POST …/wallets/{userId}/top-ups` body `{ amount, description? }` → 201 `QuinielaWalletOperationDto(userId, balance, movement)` | Coach |
| `AdjustQuinielaWallet.cs` (ICommand<T>) | `POST …/wallets/{userId}/adjustments` body `{ amount, reason }` (importe positivo = cantidad que se resta) → 201 | Coach |

DTOs: `QuinielaWalletDto(userId, userName, role, balance, totalMovements, movements)`, `QuinielaWalletOperationDto(userId, balance, movement)`,
`QuinielaTicketDto` gana además `paymentMethod` (`Cash`/`Bizum`/`Wallet`/null),
`QuinielaWalletMovementDto(id, type, amount, occurredAt, description, ticketId?)`; el listado devuelve
`QuinielaWalletSummaryDto(userId, name, role, balance)` para todos los participantes del equipo
(`UserTeams` con Coach/Player/FamilyPlayer; reutiliza `LoadParticipantsAsync`), con saldo 0 si no hay
monedero. El listado **no se pagina**: es un equipo (decenas de usuarios) y la UI necesita verlos todos;
el historial **sí** (`limit` por defecto 25, máx. 100, `offset`, orden `OccurredAt desc`).
Rutas con sustantivos, sin verbos; recarga/ajuste son subrecursos de creación (POST → 201).

Validación de entrada (FluentValidation): `amount > 0`, ≤ 2 decimales y ≤ `Rules.MaxMovementAmount`
(10,00 €, decisión del usuario), `description/reason ≤ 200` (`reason` obligatorio en el ajuste), `TeamId/UserId`
no vacíos. Reglas de negocio (dentro de la entidad/handler): el usuario destino debe pertenecer al
equipo con rol participante (si no, `NotFoundException`); saldo suficiente en el ajuste (409). Roles con
`QuinielaSupport.RequireRoleAsync` (`CoachOnly` / `ParticipantRoles`); `GET …/wallet` solo devuelve el
monedero del usuario autenticado.

Códigos de error nuevos en `Domain/ErrorCodes.cs`: `QuinielaWalletInsufficientBalance`,
`QuinielaWalletInvalidAmount`, `QuinielaWalletConcurrency`, `QuinielaWalletUserNotInTeam`,
`QuinielaTicketNotPayable`, `QuinielaTicketPaidManually`. `QuinielaTicketNotDeletable` deja de usarse.

**D7. Persistencia** (`QuinielaEntityConfiguration.cs`, configuración descubierta por reflexión):
tablas `QuinielaWallets` y `QuinielaWalletMovements` en el esquema `app`; FK de `QuinielaWallets.TeamId`
a `Teams` con cascada; movimientos como colección propia del monedero (FK `WalletId`, cascada); sin FK a
usuario ni a boleto. `DbSet<QuinielaWallet> QuinielaWallets` en `AppDbContext` (no `IdentityDbContext`
ni `FederationDbContext`; no hay cruces entre contextos salvo leer nombres como ya hace
`LoadParticipantsAsync`). SmartEnum del tipo con `SmartEnum.EFCore` (`ConfigureSmartEnum()` ya cubre el
modelo). **Migración en commit aparte** con `manage-migrations.ps1`.

**D8. Frontend (app Coach)** (`Front/src/apps/coach/`), mobile-first, tarjetas, sin tablas:
- `services/quinielaService.ts`: tipos `type` y funciones `getMyQuinielaWallet`, `getQuinielaWallets`,
  `getQuinielaWalletOf`, `topUpQuinielaWallet`, `adjustQuinielaWallet`, `payQuinielaTicketWithWallet`; `QuinielaTicket` gana
  `walletCharge?` y `paymentMethod` admite `"Wallet"`.
- `pages/quiniela/components/WalletCard.tsx` (+ `.module.css`): saldo y botón «Ver movimientos» que
  abre `WalletMovementsDialog.tsx` (lista de tarjetas por movimiento, signo y color por tipo,
  paginación «Cargar más»). Se integra en `Quiniela.tsx` para todos los roles participantes.
- Botón «Pagar con monedero» en las tarjetas de boleto **pendiente** (no expirado, pronósticos abiertos) de
  `Quiniela.tsx`/`TicketSummary`; deshabilitado con el motivo si el saldo es menor que el precio; objetivo
  táctil ≥ 48 px. Ante 409 de saldo insuficiente, snackbar de error y refresco del saldo; éxito: mismo
  snackbar de cobro que al guardar.
- Borrar mi boleto: la acción existente se muestra también en boletos pagados con monedero mientras los
  pronósticos estén abiertos, con `ConfirmDialog` que avisa del reembolso al monedero. En boletos pagados
  en mano/Bizum no se ofrece (solo el entrenador puede borrarlos y devolver el dinero).
- Aviso al guardar: en `Quiniela.tsx`, si la respuesta trae `walletCharge`, se lanza
  `window.dispatchEvent(new CustomEvent("rffm.show_snackbar", …))` con «Se han cobrado 1,00 € de tu
  monedero. Saldo: 2,00 €» y la tarjeta de saldo se refresca. `PaymentCard`/`TicketSummary` muestran
  «Pagado con monedero» para el método `Wallet`.
- Entrenador: `pages/quiniela/QuinielaWallets.tsx` (+ CSS Module), una tarjeta por usuario con nombre,
  rol traducido a español y saldo; acciones «Recargar» y «Restar saldo» abren un diálogo con importe (y
  motivo en el ajuste); el ajuste pide confirmación con `ConfirmDialog`
  (`shared/components/ui/ConfirmDialog/ConfirmDialog.tsx`); resultado con `rffm.show_snackbar`.
- Ruta lazy `quiniela/monederos` en `routes.tsx` con `RequireFeaturePermission` y entrada de menú
  «Monederos de la quiniela» en `navigation/teamSections.ts` (solo no-jugador, mismo
  `hasFeatureAccess(COACH_FEATURE_ROUTES.Quiniela)`), y la ruta en `teamNavRoutes.ts`.
- Una sola instancia de Axios (`core/api/client.ts`); estilos solo con CSS Modules y tokens del tema; sin
  `any`; importes con `Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" })`.

**D9. Versionado.** `feat` → minor: `<Version>` en `Back/ExtractionApi/Directory.Build.props`
(1.39.0 → 1.40.0) y `Front/package.json` (1.97.0 → 1.98.0), cada uno en el commit de su componente.
(Valores actuales a fecha de este cambio; ajustar si han subido antes de implementar.)

## Risks / Trade-offs

- **Cobro implícito en el PUT**: sorpresa posible → mitigado con el aviso de la respuesta y el snackbar.
- **Reintentos de concurrencia**: `ChangeTracker.Clear()` descarta cambios pendientes; el bucle debe
  recargar todo desde la BD en cada intento. Cubierto con test de integración con dos guardados en paralelo.
- **`xmin` es específico de PostgreSQL**: aceptable (única base de datos del proyecto); los tests de
  integración deben ejecutarse contra PostgreSQL real, no `InMemory`, para probar el token.
- **Dinero en custodia**: el saldo no pertenece al fondo; si el entrenador deja el equipo, hay que traspasar.
  Fuera de alcance.
- **Carrera existente** en el número de boleto (`lastNumber + 1`) no se resuelve aquí.

## Migration Plan

Migración aditiva (dos tablas nuevas, ningún cambio sobre tablas existentes ni backfill). El valor
`Wallet` del SmartEnum se guarda como `int` y no requiere migración. Rollback: revertir la migración;
los boletos con método `Wallet` quedarían con un valor desconocido, por lo que antes habría que
reembolsarlos o pasarlos a pendientes (no previsto: se despliega hacia delante).

## Open Questions

Ninguna. Decisiones finales del usuario: el participante borra sus boletos pendientes y los pagados con
monedero (con reembolso) antes del cierre de pronósticos, pero no los pagados en Cash/Bizum (D5b); un
boleto expirado no se paga con monedero (D2b); hay acción explícita de pago (D2c); el entrenador puede
recargarse y ajustarse a sí mismo; el importe máximo por movimiento de recarga o ajuste es **10,00 €**
(constante `QuinielaWallet.Rules.MaxMovementAmount`, tope de seguridad contra errores de tecleo).
