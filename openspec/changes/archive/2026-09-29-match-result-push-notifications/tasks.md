## 1. Backend — Preferencia de baja (~2h)

- [x] Red: tests de dominio de `MatchResultNotificationOptOut`/`MatchResultNotificationLog` (`Create` valida los obligatorios) y tests de endpoint: por defecto `enabled=true` con el `teamName` principal; sin principal → `teamName=null`; `PUT false` → `GET false`; `PUT true` borra la baja; idempotencia; sin `enabled` → 400; anónimo → 401.
- [x] Green: entidades + configuraciones EF en `FederationDbContext` (índices únicos), `GetMatchResultNotificationPreference.cs`, `UpdateMatchResultNotificationPreference.cs` (design.md D2–D3).
- [x] Migración `AddMatchResultNotifications` (FederationDbContext) con `manage-migrations.ps1`; commit aparte.
- **Verify**: `dotnet build` + `dotnet test --filter MatchResultNotificationPreference`.

## 2. Backend — Dispatcher (~1,5h)

- [x] Red: `WebPushNotificationDispatcherTests` para `DispatchMatchResultAsync`: un `Notification` por usuario; título/cuerpo (`Victoria:`/`Empate:`/`Derrota:` según `IsLocal`) y deep link; si el sender lanza una excepción, no se propaga.
- [x] Green: `MatchResultMessage` + método en `IWebPushNotificationDispatcher`/`WebPushNotificationDispatcher` (design.md D5).
- **Verify**: `dotnet test --filter WebPushNotificationDispatcher`.

## 3. Backend — Detección y worker (~3h)

- [x] Red: tests unitarios de `RffmRoundRefreshPolicy.EstimatedEndUtc` (y los tests actuales de `Evaluate` siguen en verde).
- [x] Red: `MatchResultNotificationServiceTests` (Postgres + `FakeRffmResultsClient` + dispatcher fake): avisa del partido del equipo principal con marcador; solo una vez en dos ejecuciones; ignora partidos de otros equipos del grupo; ignora combinaciones no principales y de otra temporada; ignora usuarios con baja; ignora partidos sin marcador y fuera de la ventana de 48 h; refresca la jornada vía `GetMatchDayAsync` cuando falta el marcador; un grupo que falla no bloquea a otro; usuarios con el mismo equipo reciben un único dispatch agrupado.
- [x] Green: extraer `EstimatedEndUtc`, `IMatchResultNotificationService`/`MatchResultNotificationService`, `MatchResultNotificationWorker` (`PeriodicTimer`), `ResultNotificationPollMinutes`/`ResultNotificationWindowHours` en `RffmResultsRefreshSettings`, registro en DI (design.md D1, D4).
- **Verify**: `dotnet build` + `dotnet test`.

## 4. Frontend — Interruptor en Resultados (~2h)

- [x] Red: `matchResultNotificationService.test.ts`; `MatchResultNotificationsToggle.test.tsx` (refleja la preferencia con el nombre del equipo; desactivar → `PUT false`; error → revierte + snackbar; sin equipo principal → aviso sin switch; sin suscripción push → enlace a Ajustes); `Results.test.tsx` lo renderiza.
- [x] Green: servicio, componente + CSS Module y uso en `Results.tsx` (design.md D6).
- [ ] Revisión visual a ~375 px y en escritorio con el tema Coach.
- **Verify**: `npm run test` + `npm run build`.

## 5. Validación

- [x] `openspec validate match-result-push-notifications --strict`.
- [x] Suites completas de back y front en verde; preguntar al usuario antes de commitear.
- [ ] Tras el primer fin de semana de liga: comprobar si la RFFM publica goles antes del acta cerrada (design.md, Risks).
