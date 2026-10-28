## Contexto

- Los partidos de liga ya se persisten (`RffmRound` → `RffmMatch`, con `Status`, `StatusReason`,
  `GameSituation`, `LocalGoals`, `VisitorGoals`, `IsFinal`).
- La pertenencia al equipo es `UserTeam` con `Membership` (`Coach`, `Player`, `FamilyPlayer`).
- Ya existe la «bolsa del equipo» (`TeamFundMovement`, saldo = suma de movimientos).
- Referencia de patrón para página de entrenador: `Features/Coaches/Lottery` y `pages/lottery`.

## Decisiones

**D1. Modelo (AppDbContext, schema `app`)**
- `QuinielaJornada`: `TeamId`, `RffmRoundId`, `Price` (1,00), `PrizePercent` (55), `CarryIn`, `Status` (Open / Settled), `SettledAt`, `CarryOut`. Único por
  `(TeamId, RffmRoundId)`.
- `QuinielaTicket`: `JornadaId`, `ApplicationUserId`, `PlenoHome`/`PlenoAway` (0, 1, 2, 3 = M),
  `PaymentStatus` (Pending / Paid), `PaidAt`, `PaymentMethod`, `Hits`, `Category`, `Prize`. Único por
  `(JornadaId, ApplicationUserId)`.
- `QuinielaPick` (owned, colección): `RecordCode` del partido + `Sign` (1/X/2).
- Enums como SmartEnum, no enteros crudos. Entidades con fábrica y métodos con intención.

**D2. Partidos válidos y Pleno.** Un partido es válido si no está aplazado ni suspendido (campos
`Status`/`StatusReason`/`GameSituation` de `RffmMatch`; **verificar con datos reales** cómo marca la
RFFM un aplazamiento antes de implementar). El Pleno es el último partido válido por fecha y hora.
Se evalúa siempre al leer/liquidar, no se congela: si un partido se aplaza después de guardar
boletos, deja de contar sin tocar los pronósticos.

**D3. Cierre de pronósticos.** Se rechaza guardar o editar el boleto cuando ha empezado el primer
partido válido (hora de Madrid).

**D4. Plazo de pago.** Viernes 23:59 (Madrid) de la semana del primer partido. Es derivado:
`Pending` pasado el plazo se muestra y se trata como «Expirado», sin trabajo en segundo plano. Un
boleto expirado no entra en el reparto. El entrenador puede marcarlo pagado antes de liquidar.

**D5. Liquidación (`POST …/settle`, solo entrenador).** Exige todos los partidos válidos finalizados.
Cálculo puro en un servicio de dominio (`QuinielaScoring`): aciertos por boleto y categoría
(Especial = todos + Pleno exacto, 1ª = todos, 2ª = todos−1, 3ª = todos−2).
- Bolsa de premios = cobrado × 55 % + `CarryIn` (solo boletos `Paid` y no expirados cobran y reparten).
  El 45 % restante → `TeamFundMovement` con `TeamFundMovementSource.QuinielaFund`.
- Pesos oficiales de La Quiniela adaptados a 4 categorías, reescalados al 55 %: Especial 7,5 /
  1ª 16 / 2ª 7,5 / 3ª 7,5 (suma 38,5). Cada categoría recibe bolsa × peso / 38,5. Son constantes del
  dominio (`QuinielaScoring.WeightFor`), no un parámetro.
- Reparto a partes iguales entre los acertantes de la categoría, truncado al céntimo; los restos van
  al bote.
- Categorías desiertas (reglas oficiales): Especial → bote; 1ª → bote; 2ª → su importe se suma a la
  3ª; 3ª desierta (incluido lo recibido de la 2ª) → bote.
- Un premio nunca supera al de una categoría superior: si el premio unitario de una categoría resulta
  mayor que el de alguna superior con acertantes, se suman ambos fondos y se reparten entre los
  acertantes de las dos categorías (se repite en cascada).
- `CarryOut` = bolsa − premios repartidos; la siguiente jornada lo toma como `CarryIn`.
- `QuinielaJornada` ya no guarda porcentajes por categoría (solo `Price`, `PrizePercent`, `CarryIn`).

**D6. Apertura.** El entrenador abre la quiniela de la siguiente jornada (`POST`); no se crea sola.
Los demás ven «la quiniela aún no está abierta». Evita efectos secundarios en un `GET`.

**D7. Endpoints (Minimal API, `IFeatureModule`, 1 feature = 1 `.cs`)**
- `POST /api/teams/{teamId}/quiniela` — abrir jornada (Coach).
- `GET  /api/teams/{teamId}/quiniela/current` — jornada, partidos, mi boleto, bolsa, resultado
  anterior (Coach/Player/FamilyPlayer).
- `PUT  /api/teams/{teamId}/quiniela/{jornadaId}/ticket` — guardar mi boleto.
- `GET  /api/teams/{teamId}/quiniela/{jornadaId}/payments` — boletos, totales, movimientos (Coach).
- `PUT  /api/teams/{teamId}/quiniela/{jornadaId}/tickets/{ticketId}/payment` — pagado / pendiente
  (Coach).
- `POST /api/teams/{teamId}/quiniela/{jornadaId}/settle` — liquidar (Coach).
- Cada `ICommand` con `Validator`; errores `ProblemDetails`; el rol se comprueba contra `UserTeam`.

**D8. Frontend (app Coach).** `pages/quiniela/Quiniela.tsx` (participante) y
`pages/quiniela/QuinielaPool.tsx` (entrenador); componentes `MatchPickCard`, `PlenoCard`,
`QuinielaRulesDialog`, `PaymentCard`, `PoolSummary`; `quinielaService.ts` con tipos `type`; CSS
Modules y tema Coach; páginas lazy en `routes.tsx` y entrada de menú siguiendo el patrón de
Lottery. Tarjetas, nunca tablas; probado a ~360 px. Avisos con `rffm.show_snackbar`; confirmación
de liquidar con `ConfirmDialog`. La lógica de aciertos vive solo en backend; el front la muestra.

**D9. Menú y panel del equipo.** Patrón de Lotería:
- `COACH_FEATURE_ROUTES.Quiniela = "/coach/quiniela"` (`constants/featureRoutes.ts`) y la ruta en
  `navigation/teamNavRoutes.ts` para que el equipo siga en contexto.
- `navigation/teamSections.ts`: dos entradas en el grupo «Competición», con `team(...)`:
  «Quiniela» (`/coach/quiniela`, todos los roles con acceso) y «Bolsa de la quiniela»
  (`/coach/quiniela/bolsa`, solo no-jugador/entrenador), cada una con `hasFeatureAccess`.
- Panel `/coach/team-dashboard`: `QuickActions` ya toma sus accesos de `buildTeamSections`; se añade
  la clave `quiniela` a `QUICK_ACTION_KEYS` (`components/QuickActions.tsx`), así aparece como acción
  rápida con el mismo icono y permiso que el menú.
- `routes.tsx`: rutas `quiniela` y `quiniela/bolsa` envueltas en `RequireFeaturePermission`.

**D10. Tarjeta «Quiniela» en la home del equipo (`/coach/team-dashboard`).** Diseño en
`.design/quiniela/` (`Home`, `HomeMovil`, `QuinielaPromo`, `Estados`).
- Componente `team-dashboard/components/QuinielaPromoCard.tsx` (+ CSS Module), primer elemento de la
  columna principal, para todos los roles con acceso a la feature (jugador, familiar, entrenador). Los
  jugadores/familiares no tienen «Acciones rápidas», por eso es una tarjeta y no solo un acceso.
- Datos: `GET …/quiniela/current` (ya existente). Solo se muestra si hay quiniela abierta; si no está
  abierta no se muestra, salvo para el entrenador, que ve un acceso discreto «Abrir quiniela».
- Estados: sin rellenar, rellenado pendiente de pago (plazo viernes 23:59), pagado, cerrado. CTA
  principal ≥ 48 px («Rellenar mi boleto» / «Ver mi boleto» / «Ver resultados») hacia `/coach/quiniela`,
  y enlace «Ver reglas».
- Etiqueta «Novedad»: visible hasta que el usuario abre la quiniela por primera vez o pasan 14 días
  desde el lanzamiento (constante `QUINIELA_LAUNCH_DATE`), lo que ocurra antes. Se guarda en
  `localStorage` (por usuario y equipo) con `try/catch`; sin almacenamiento, se muestra por fecha.
  Pasado el plazo la tarjeta se mantiene sin etiqueta.
- Tokens del tema real (cian `--rffm-primary`, `--rffm-card-bg`, `--rffm-status-pending` para la
  etiqueta); sin colores nuevos. Responsive mobile-first; sin tablas.

