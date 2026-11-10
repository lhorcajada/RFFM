## Proposal

### Why

Hoy el icono de hucha de la cabecera del entrenador abre la página de sanciones, y el dinero del equipo se reparte entre cuatro pantallas no relacionadas (sanciones, lotería, quiniela, monedero de quiniela) sin una vista única. La issue #8 pide una única ventana que liste cada transacción del equipo con su estado de pago, para que el entrenador vea de un vistazo qué está pagado y qué sigue debiendo.

### What Changes

- Añadir un endpoint de solo lectura `GET /api/catalog/team/{teamId}/transactions` que fusiona en memoria las sanciones del equipo, los talonarios de lotería, los tickets de quiniela, las recargas y cargos del monedero de quiniela y los movimientos del fondo del equipo originados en la quiniela, en una única lista de transacciones. Cada transacción tiene un tipo, una persona, un importe, una fecha, una descripción y un estado tipado (`Pending` o `Paid`). La lista se ordena por fecha, de la más reciente a la más antigua, y puede filtrarse por `status` y `type`.
- Añadir una nueva página de entrenador en `/coach/transactions` que muestra las transacciones como tarjetas apiladas y responsive (sin tabla), con filtros de estado y tipo y un mensaje de lista vacía.
- Cambiar el icono de hucha de la cabecera para que abra `/coach/transactions?teamId=<id>` en lugar de la página de sanciones. El botón de sanciones y el menú lateral siguen abriendo `/coach/sanctions`.
- Restringir el endpoint a los usuarios que pertenecen al equipo solicitado; para un equipo ajeno se devuelve acceso denegado como `ProblemDetails`.
- No se crean ni modifican tablas, columnas ni migraciones. Los flujos de pago no se tocan. Mobile queda fuera de alcance.

## Design

### Target State

Al completar el cambio, un miembro del equipo pulsa el icono de hucha de la cabecera, llega a `/coach/transactions?teamId=<id>` y ve las sanciones, talonarios de lotería, tickets de quiniela, recargas del monedero, cargos del monedero y movimientos del fondo de quiniela del equipo como una única lista filtrable de tarjetas, cada una con un estado tipado `Pending` / `Paid`. Los datos provienen de un nuevo endpoint de solo lectura que fusiona tablas existentes en memoria. No hay cambios en tablas, columnas ni migraciones.

### Goals / Non-Goals

Goals:

- Un único endpoint de solo lectura que devuelva la lista fusionada, filtrada y ordenada por fecha tal como indica la spec `team-transactions-list`, con acceso limitado a los miembros del equipo.
- Una única página de tarjetas responsive y el cambio de destino del icono de cabecera que exige el delta de `team-fund`.
- Sin cambios de esquema, sin tocar ningún flujo de escritura y sin nueva capa de caché.

Non-Goals:

- Pantallas de Mobile, y cualquier cambio en los flujos de escritura de sanciones, lotería, quiniela o monedero.
- Fuera de alcance: paginación de la lista de transacciones. Se revisará cuando la lista de un equipo crezca lo suficiente como para ralentizar la página o la respuesta.
- Fuera de alcance: listar los movimientos de monedero `Adjustment`, `TicketRefund`, `Prize` y `Donation`, y las sanciones sin multa. Se revisará cuando la issue pida un libro mayor completo en lugar de una lista por estado de pago.
- Fuera de alcance: una fila dedicada de permiso de funcionalidad para `/coach/transactions` y una constante de ruta en backend. Se revisará cuando las transacciones necesiten reglas de acceso distintas a las de sanciones.

### Decisions

#### 1. One feature file, mirroring `GetTeamFund`

`Features/Coaches/Teams/Queries/GetTeamTransactions.cs` contiene el endpoint, el record de consulta, el handler, el DTO y los enums. La ruta es literal, `api/catalog/team/{teamId}/transactions`, con `RequireAuthorization()`. El endpoint parsea `status` y `type` a enums anulables y devuelve `Results.ValidationProblem(...)` (400 ProblemDetails) para cualquier valor fuera de los conjuntos cerrados antes de enviar la consulta, con el mismo patrón que el parseo de `SourceCategory` en `SetPlayerSanction.cs`. El parseo acepta solo los nombres definidos (sin distinguir mayúsculas), nunca cadenas numéricas.

**Provenance**: codebase-forced

#### 2. Membership check through `RequireRoleAsync` with `ParticipantRoles`

El handler llama a `QuinielaSupport.RequireRoleAsync` con `ParticipantRoles` (Coach, Player, FamilyPlayer). Así se obtiene exactamente el conjunto de acceso de la spec: miembros del equipo con esos roles, más el coach o directivo del club mediante la ruta del club, 403 ProblemDetails para el resto y 401 para los anónimos (además protegido por `RequireAuthorization()`). No se escribe ningún helper de acceso nuevo.

**Provenance**: derived

#### 3. In-memory merge with one projected query per source

El handler ejecuta una consulta proyectada `AsNoTracking()` por fuente, filtrada por equipo: sanciones con `Fine > 0`, talonarios unidos a las campañas del equipo, tickets unidos a las jornadas del equipo, movimientos de monedero de tipo `TopUp`/`TicketCharge` unidos a los monederos del equipo, y movimientos del fondo con origen `QuinielaFund`/`QuinielaDonation` (así nunca se lee `SanctionPayment`, cumpliendo que "un pago de sanción se lista una sola vez"). Cada fila se convierte en un record privado; después la lista se filtra por `status`/`type` y se ordena por `date` descendente, con las filas sin fecha al final y un desempate determinista (tipo, luego id). Cuando se indica `type`, no se consultan las fuentes que no pueden producir ese tipo. Las fechas de las fuentes `DateOnly` se convierten a `DateTime` a medianoche UTC para que todas las fuentes compartan un mismo tipo de ordenación.

Alternativas: una `UNION` en SQL como vista (descartada: necesita una vista o migración que la propuesta prohíbe, y lógica de deadline entre bases de datos); una tabla de libro mayor persistida (descartada: migración y cambios en el flujo de escritura).

**Provenance**: derived

#### 4. Status and amounts computed per type at query time

`TransactionStatus` es `Pending` o `Paid` y nunca se persiste. Según la spec: sanción `Paid` cuando `AmountPaid >= Fine`, importe pendiente `Fine - AmountPaid` (un `AmountPaid` nulo cuenta como cero); talonario `Paid` cuando `AmountReturned` está informado, importe `AmountReturned` si no, `TicketPrice * TicketsPerBook`; ticket `Paid` solo cuando su estado de pago persistido es `Paid` (un estado efectivo `Expired` nunca se filtra: si no está pagado sigue siendo `Pending`), importe `Price`; movimientos del fondo, recargas y cargos siempre `Paid` con `Math.Abs(Amount)`. `pendingAmount` es igual al `amount` completo para un talonario o ticket pendiente, y nulo para `Paid`. Un ticket pagado desde el monedero aparece dos veces por diseño: una como ticket `Quiniela` y otra como movimiento `WalletCharge`.

**Provenance**: user

#### 5. Quiniela ticket date and deadline batching

Para los tickets con `PaidAt` no nulo, la fecha es `PaidAt`. Para los tickets sin pagar, el handler recoge los valores `RffmRoundId` distintos de sus jornadas, carga en una sola consulta desde `FederationDbContext` las filas `RffmMatch` correspondientes (mismo patrón que `QuinielaLifecycle.cs`), conserva las válidas según `QuinielaMatchValidity.IsValid`, toma la fecha más temprana y se la pasa a `QuinielaSchedule.PaymentDeadlineUtc`. Una jornada sin partido válido con fecha da fecha nula. Se reutiliza el código existente de `QuinielaRound` cuando se puede construir a partir de esas filas; no se crea una segunda fórmula de deadline.

**Provenance**: codebase-forced

#### 6. Person names and descriptions

`personName` para sanciones y talonarios sale de la unión `TeamPlayer` -> `Player` usada en `GetQuinielaWallets.cs`; para tickets de quiniela y movimientos de monedero sale de `QuinielaSupport.LoadParticipantsAsync` (cargado en lote una vez por petición para todos los ids de usuario). Los movimientos del fondo de quiniela no tienen persona. `description` es el texto propio de la fuente cuando lo tiene (`TeamFundMovement.Description`, `QuinielaWalletMovement.Description`, un campo de texto de la sanción si la entidad lo expone) y, si no, un texto de respaldo en español construido a partir de la etiqueta del tipo, de modo que el campo nunca está vacío.

**Provenance**: derived

#### 7. No caching

El endpoint no implementa `ICacheRequest` ni `IInvalidateCacheRequest`. `GetTeamFund`, y las funcionalidades de sanciones, lotería y quiniela no usan caché, así que no existe ruta de invalidación que mantenga correcta una lista cacheada; el estado de pago que consulta el entrenador debe ser actual. La frase de la propuesta "misma política de caché que `GetTeamFund`" se resuelve, por tanto, como "ninguna".

**Provenance**: codebase-forced

#### 8. The web route reuses the Sanctions feature key

`/coach/transactions` se envuelve con `RequireFeaturePermission` usando `COACH_FEATURE_ROUTES.Sanctions`. Una clave nueva necesitaría una constante `CoachFeatureRoutes`, una entrada en `featureRoutes.ts` y tuplas de seed para cada rol, y hasta que el seed se ejecute `hasFeatureAccess` devuelve false para todos los no administradores. Reutilizar la clave mantiene literal el requisito de la spec de "mismo guard de permiso de funcionalidad que la ruta de sanciones" y no necesita cambios en el seed; Player y FamilyMember ya tienen filas de lectura de Sanctions, y Coach y ClubDirector tienen filas de lectura y escritura.

Alternativa: una clave nueva `/coach/transactions` con filas seed para Coach, ClubDirector, Player y FamilyMember (descartada: trabajo extra de seed y una dependencia del orden de arranque sin ningún comportamiento que pidan las specs).

**Provenance**: derived

#### 9. Frontend structure, team resolution and error behavior

- `transactionService.ts` sigue a `teamFundService.ts` (cliente Axios compartido, `type` exportados) pero lanza error en lugar de devolver `null`/`[]`, para que la página pueda mostrar el mensaje de error requerido.
- La página lee `teamId` con `useSearchParams` y, si falta, lo resuelve con el export por defecto de `shared/hooks/resolveUserTeamId.ts` (la misma resolución que usa el icono de cabecera: equipo del perfil, luego equipo preferido).
- Los filtros son dos grupos de botones (estado: Todos/Pendiente de pago/Pagado; tipo: Todos/Sanciones/Lotería/Quiniela/Recargas/Cargos) con el estilo de la fila de filtros de Sanciones; cada cambio vuelve a pedir la lista con `status`/`type`, de modo que el filtrado es del lado del servidor, como indica el contrato de endpoint de la spec.
- `TransactionCard` es un `Paper` con la persona, una etiqueta de tipo, el importe, la fecha (`date-fns`) y un `Chip` de estado (`Pagado` en success, `Pendiente de pago` en error, con el importe pendiente mostrado), en una columna flex apilada. Solo CSS Module, tokens de las propiedades personalizadas `--rffm-*` existentes, sin tabla ni grid de columnas fijas, sin estilos inline. Una lista vacía muestra el componente `EmptyState`; una carga fallida muestra el error y ninguna tarjeta, mediante el evento de bus `rffm.show_snackbar` más un mensaje en línea.
- El cambio en la cabecera es solo la cadena de destino en `handleOpenTeamFund`; su test existente (`AppHeader.teamFundBalance.test.tsx`, que comprueba `/coach/sanctions?teamId=team-7`) se actualiza a `/coach/transactions?teamId=team-7`.

**Provenance**: derived

### Risks / Trade-offs

- [La clave de permiso de Sanciones también controla transacciones: un usuario cuyo rol no tenga fila de permiso de Sanciones no puede abrir la página aunque el backend lo permitiría] → Los roles que superan la comprobación de pertenencia en backend (Coach, Player, FamilyPlayer, coach/directivo del club) tienen hoy filas de Sanciones; un cambio de rol en el seed exige revisar de nuevo la página de transacciones.
- [Lista sin límite: sin paginación, un equipo grande devuelve todas las transacciones] → La spec no la pide; una consulta proyectada por fuente con `AsNoTracking()` mantiene el coste lineal, y la paginación queda registrada como no-objetivo.
- [La traducción en EF de las comparaciones con SmartEnum en las consultas por equipo (`QuinielaWalletMovementType`, `TeamFundMovementSource`, estado de pago) podría no traducirse tal como está escrita] → Comparar con las constantes del SmartEnum como ya hacen las funcionalidades de monedero y fondo, y cubrir cada fuente con un test de integración sobre PostgreSQL real.
- [`LoadParticipantsAsync` y `QuinielaRound` son helpers internos cuyas firmas exactas solo se leyeron a través de sus llamadas] → Reutilizarlos tal cual si su forma encaja; si no, extraer la mínima pieza compartida en lugar de duplicar la lógica de deadline o de nombres.
- [Los campos de texto de descripción de sanciones y talonarios no se leyeron todos] → El texto de respaldo con la etiqueta del tipo en español mantiene `description` no vacía independientemente de qué campos existan en la fuente.
- [Las fuentes con solo fecha se normalizan a medianoche UTC, así que el orden entre tipos en el mismo día depende del desempate] → El desempate determinista (tipo, id) mantiene el orden estable entre llamadas.

### Open Questions

None. Todas las incógnitas anteriores son comprobaciones en tiempo de implementación que no cambian el comportamiento que describen las specs.

### Manual Verification

- Prueba de extremo a extremo sobre la API real y la aplicación web: iniciar sesión como entrenador con un equipo que tenga al menos una sanción pendiente, un talonario entregado y un ticket de quiniela; pulsar el icono de hucha de la cabecera y confirmar que el navegador llega a `/coach/transactions?teamId=<id>`, que aparecen tarjetas de cada fuente con las etiquetas `Pendiente de pago` / `Pagado`, y que los filtros de estado y tipo reducen la lista. Repetir con un viewport de 360 px y confirmar que las tarjetas se apilan sin desplazamiento horizontal y sin tabla.
- Prueba de acceso de extremo a extremo: abrir `/coach/transactions?teamId=<id de otro equipo>` con sesión de un usuario de otro equipo y confirmar que la página muestra el mensaje de error y ninguna tarjeta (la API devuelve 403).
- Deriva de artefactos generados: tras la subida de versión web (`npm version --no-git-tag-version`), confirmar que los campos `version` de `Front/package.json` y `Front/package-lock.json` coinciden y que `<Version>` de `Back/ExtractionApi/Directory.Build.props` lleva la subida de minor; no se añaden archivos de migración.

## Step 1: Team transactions endpoint with the API version bump

### Interfaces

**Interfaces**: En `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Teams/Queries/GetTeamTransactions.cs`:

- `public class GetTeamTransactions : IFeatureModule` con `AddRoutes(IEndpointRouteBuilder app)` que mapea `GET api/catalog/team/{teamId}/transactions` con los parámetros de consulta `status` y `type` (cadenas), `RequireAuthorization()`.
- `public enum TransactionType { Sanction, Lottery, Quiniela, WalletTopUp, WalletCharge }`
- `public enum TransactionStatus { Pending, Paid }`
- `public record TeamTransactionsQuery(string TeamId, TransactionStatus? Status, TransactionType? Type) : IQueryApp<IReadOnlyList<TeamTransactionDto>>`
- `public record TeamTransactionDto(string Id, string Type, string? PersonName, decimal Amount, decimal? PendingAmount, DateTime? Date, string Description, string Status)` — `Type` y `Status` llevan los nombres de los enums.
- `public class Handler(AppDbContext db, FederationDbContext fed, ICurrentUserService currentUser) : IRequestHandler<TeamTransactionsQuery, IReadOnlyList<TeamTransactionDto>>`.
- `Back/ExtractionApi/Directory.Build.props` `<Version>` se sube una versión minor.
- El handler devuelve filas de los cinco tipos: `Sanction`, `Lottery`, `Quiniela` (tickets y movimientos del fondo de quiniela), `WalletTopUp` y `WalletCharge`.

**Test assertions**: Redactadas a partir de `openspec/changes/team-transactions-window/specs/team-transactions-list/spec.md`.

- Requisito "Access is limited to members of the team, and players and family members see only their own transactions": un usuario vinculado como Player o familiar recibe solo sus transacciones (su quiniela y monedero, y las sanciones y lotería del jugador vinculado, sin movimientos del fondo); el entrenador del equipo recibe toda la lista; un entrenador del club del equipo recibe la lista; un usuario autenticado de otro equipo hace que el handler lance `ForbiddenAccessException` y no se devuelve ninguna transacción.
- Requisito "A team without transactions returns an empty list": un equipo sin datos devuelve una lista vacía (no null).
- Requisito "Transaction sources and types", escenario "Sanction without a fine is not listed": las sanciones con `Fine` nulo o 0 no producen fila; una sanción con `Fine: 100` produce una fila de tipo `Sanction` con el `StartDate` de la sanción como `Date` y el nombre del jugador como `PersonName`.
- Requisito "Payment status is a typed two-value state computed per type": `Fine: 100, AmountPaid: 40` -> `Status` `Pending`, `PendingAmount` 60; `Fine: 100, AmountPaid: 100` -> `Paid`, `PendingAmount` nulo; `Fine: 50, AmountPaid` nulo -> `Pending`, `PendingAmount` 50.
- Mismo requisito, lotería: talonario con `AmountReturned` nulo, campaña con `TicketPrice` 2 y `TicketsPerBook` 10 -> `Pending`, `Amount` 20, `PendingAmount` 20; talonario con `AmountReturned: 15` -> `Paid`, `Amount` 15.
- Requisito "Transaction sources and types", escenario "Each type takes its date from its own source field": talonario con `ReturnedOn` 2 de marzo y `DeliveredOn` 20 de febrero -> `Date` es 2 de marzo a las 00:00 UTC; con `ReturnedOn` nulo -> `Date` es `DeliveredOn` a las 00:00 UTC.
- Requisito "A sanction payment is listed only once": una sanción con `AmountPaid: 40` y un `SanctionPayment` de fondo vinculado produce exactamente una fila.
- Requisito "Transactions are ordered by date and filterable": filas con fechas 1, 5 y 3 de marzo se devuelven como 5, 3, 1 de marzo; con `Status` `Pending` solo se devuelven filas pendientes; con `Type` `Lottery` solo se devuelven filas de lotería; `Status` `Paid` con `Type` `Sanction` devuelve solo sanciones pagadas.

- Requisito "Transaction sources and types", escenario "Quiniela fund movements are listed as Quiniela transactions": un `TeamFundMovement` con origen `QuinielaFund` o `QuinielaDonation` produce una fila `Quiniela` con `Status` `Paid`, `Date` igual a `OccurredAt`, `Amount` igual al `Amount` en valor absoluto y `PersonName` nulo.
- Mismo requisito, escenario "Wallet top-up and charge are listed with their own types": un movimiento `TopUp` y un movimiento `TicketCharge` producen una fila `WalletTopUp` y una fila `WalletCharge`, cada una con `Status` `Paid`, `Date` igual a `OccurredAt` y el nombre del titular del monedero como `PersonName`.
- Mismo requisito, escenario "Wallet movements other than top-ups and charges are not listed": movimientos de tipo `Prize`, `Adjustment`, `TicketRefund` y `Donation` no producen fila.
- Mismo requisito, escenario "Ticket paid from the wallet is listed as ticket and as charge": un ticket pagado desde el monedero produce una fila `Quiniela` y una fila `WalletCharge`.
- Mismo requisito, escenario "A sanction payment is listed only once" (segunda cláusula): un `TeamFundMovement` con origen `SanctionPayment` nunca produce fila.
- Requisito "Payment status is a typed two-value state computed per type", escenario "Paid quiniela ticket is paid": un ticket con `PaymentStatus` pagado y `PaidAt` informado -> `Status` `Paid`, `Amount` igual al `Price` de la jornada, `Date` igual a `PaidAt`.
- Mismo requisito, escenario "Unpaid quiniela ticket past its deadline stays pending": un ticket sin pagar cuyo deadline ya pasó -> `Status` `Pending` (nunca `Expired`), `PendingAmount` igual al `Price` de la jornada.
- Requisito "Transaction sources and types", escenario "Unpaid ticket takes the payment deadline as its date": un ticket sin pagar cuya jornada tiene un partido válido con fecha -> `Date` igual a `QuinielaSchedule.PaymentDeadlineUtc` de la fecha de partido válida más temprana de esa ronda.
- Requisito "Transactions are ordered by date and filterable", escenario "Transaction without a date is ordered last": un ticket sin pagar cuya ronda no tiene partido válido con fecha tiene `Date` nulo y se lista después de una sanción con fecha.
- Mismo requisito, escenario "Ordering mixes transaction types by their source dates": sanción del 1 de marzo, ticket pagado del 5 de marzo y recarga del 3 de marzo se devuelven como ticket, recarga, sanción.
- Mismo requisito, filtros: `Type` `Quiniela` devuelve solo tickets y movimientos del fondo; `Type` `WalletCharge` devuelve solo cargos.

**Endpoint-level test assertions** (clase `GetTeamTransactionsEndpointTests` en `Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/GetTeamTransactionsEndpointTests.cs`, sobre el pipeline HTTP real con un manejador de autenticación de prueba; las aserciones a nivel de handler anteriores viven en `GetTeamTransactionsHandlerTests`):

- `openspec/changes/team-transactions-window/specs/team-transactions-list/spec.md`, requisito "Transactions are ordered by date and filterable", escenario "Unknown filter value is rejected": `GET /api/catalog/team/{teamId}/transactions?status=Expired` responde `400` con un cuerpo ProblemDetails; lo mismo para `type=Unknown` y para valores numéricos como `status=1` y `type=2`.
- Mismo requisito, escenarios "Filter by status" y "Filter by type": `?status=Pending` y `?type=Lottery` (nombres sin distinguir mayúsculas) responden `200` con el array filtrado.
- Requisito "Access is limited to members of the team, and players and family members see only their own transactions", escenario "Unauthenticated request is rejected": una petición sin credenciales responde `401`.
- Mismo requisito, escenario "User of another team is denied": un usuario autenticado que no está en el equipo recibe `403` con un cuerpo ProblemDetails y sin datos de transacciones.
- Requisito "A team without transactions returns an empty list", escenario "Endpoint returns an empty list": el endpoint responde `200` con el array JSON `[]`.

### Tasks

**Files Affected**:

```text
A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Teams/Queries/GetTeamTransactions.cs
A Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/GetTeamTransactionsHandlerTests.cs
A Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/GetTeamTransactionsEndpointTests.cs
M Back/ExtractionApi/Directory.Build.props
```

## Step 2: Coach transactions page, service and route

### Interfaces

**Interfaces**: En `Front/src/apps/coach/services/transactionService.ts`:

- `export type TransactionType = "Sanction" | "Lottery" | "Quiniela" | "WalletTopUp" | "WalletCharge"`
- `export type TransactionStatus = "Pending" | "Paid"`
- `export type TeamTransaction = { id: string; type: TransactionType; personName?: string | null; amount: number; pendingAmount?: number | null; date?: string | null; description: string; status: TransactionStatus }`
- `export type TransactionFilters = { status?: TransactionStatus; type?: TransactionType }`
- `export async function getTeamTransactions(teamId: string, filters?: TransactionFilters): Promise<TeamTransaction[]>` — llama a `GET /api/catalog/team/{teamId}/transactions` con los filtros como parámetros de consulta a través del cliente compartido; se rechaza cuando la petición falla.
- `export default { getTeamTransactions }`

En `Front/src/apps/coach/pages/transactions/components/TransactionCard.tsx`: `export default function TransactionCard(props: { transaction: TeamTransaction }): JSX.Element`.

En `Front/src/apps/coach/pages/transactions/Transactions.tsx`: `export default function Transactions(): JSX.Element`, enrutada en `/coach/transactions` y cargada de forma lazy desde `Front/src/apps/coach/routes.tsx`.

**Test assertions**: Redactadas a partir de `openspec/changes/team-transactions-window/specs/team-transactions-list/spec.md`, requisito "The coach app shows transactions in a responsive card list", con el módulo de servicio mockeado.

- Escenario "Transactions are shown as cards with translated status": la lista mockeada contiene un ticket de quiniela pagado y una sanción pendiente con `pendingAmount` 60; la página renderiza dos tarjetas, la primera con el texto «Pagado», la segunda con «Pendiente de pago» y el importe 60.
- Escenario "Status filter narrows the cards": pulsar el filtro de estado pendiente llama a `getTeamTransactions` con `{ status: "Pending" }` y la página muestra solo tarjetas con la etiqueta «Pendiente de pago».
- Escenario "Type filter narrows the cards": pulsar el filtro de tipo lotería llama a `getTeamTransactions` con `{ type: "Lottery" }`.
- Escenario "Layout works on a narrow screen": la página renderizada no contiene ningún rol `table` ni ningún elemento con rol `columnheader`.
- Escenario "Load failure shows an error": cuando `getTeamTransactions` se rechaza, la página muestra un mensaje de error y cero tarjetas de transacción.
- Requisito "A team without transactions returns an empty list", escenario "Page shows an empty-list message": una lista mockeada vacía muestra el mensaje de lista vacía y ningún mensaje de error.
- Resolución de equipo: con `?teamId=team-9` en la URL el servicio se llama con `"team-9"`; sin `teamId` y con `resolveUserTeamId` resolviendo `"team-3"`, se llama con `"team-3"`.

### Tasks

**Files Affected**:

```text
A Front/src/apps/coach/services/transactionService.ts
A Front/src/apps/coach/pages/transactions/Transactions.tsx
A Front/src/apps/coach/pages/transactions/Transactions.module.css
A Front/src/apps/coach/pages/transactions/components/TransactionCard.tsx
A Front/src/apps/coach/pages/transactions/components/TransactionCard.module.css
A Front/src/apps/coach/pages/transactions/__tests__/Transactions.test.tsx
M Front/src/apps/coach/routes.tsx
```

## Step 3: Header piggy-bank opens the transactions page with the web version bump

### Interfaces

**Interfaces**: Sin firmas nuevas; el `handleOpenTeamFund` existente en `Front/src/shared/components/ui/AppHeader/AppHeader.tsx` navega a `/coach/transactions?teamId=<teamFund.teamId>` en lugar de `/coach/sanctions?teamId=<teamFund.teamId>`. `Front/package.json` y `Front/package-lock.json` llevan la misma `version` con la subida de minor.

**Test assertions**: Redactadas a partir de `openspec/changes/team-transactions-window/specs/team-fund/spec.md`, requisito "Team fund balance icon is visible to every user in the app header".

- Escenario "Clicking the fund balance icon opens the team transactions page": con el hook de fondo mockeado devolviendo el id de equipo `team-7`, pulsar el botón team-fund-balance llama a `navigate` con `/coach/transactions?teamId=team-7` y nunca con una ruta `/coach/sanctions`.
- Escenario "Sanctions entry points keep going to sanctions": pulsar el icono de notificación de sanciones pendientes sigue navegando a `/coach/sanctions` (el test existente `AppHeader.pendingSanctionsBadge.test.tsx` sigue en verde sin cambios).

### Tasks

**Files Affected**:

```text
M Front/src/shared/components/ui/AppHeader/AppHeader.tsx
M Front/src/shared/components/ui/AppHeader/__tests__/AppHeader.teamFundBalance.test.tsx
M Front/package.json
M Front/package-lock.json
```
