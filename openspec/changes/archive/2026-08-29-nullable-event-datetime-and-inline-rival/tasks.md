## 1. Backend — Domain: `SportEvent` nullable `EveDateTime`/`StartTime`

- [x] 1.1 Escribir tests (RED) en nuevo archivo
      `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/SportEventTests.cs`:
      - `SetEveDateTime(null)` no lanza y deja `EveDateTime == null`.
      - `SetEveDateTime(default)` sigue lanzando `ArgumentException`.
      - `SetEveDateTime(pastDate)` sigue lanzando.
      - `SetStartTime(null)` no lanza y deja `StartTime == null`.
      - `SetStartTime` sigue validando default/pasado/orden-con-EndTime cuando se
        pasa un valor.
      - `SetEndTime` sigue validando orden con `StartTime` solo cuando `StartTime`
        tiene valor; no lanza si `StartTime` es `null`.
      Confirmar que fallan contra el código actual (no compila porque los setters aún
      son `DateTime` no-nullable, o el test asume `DateTime?`).
- [x] 1.2 Cambiar `EveDateTime`/`StartTime` a `DateTime?` en
      `Domain/Aggregates/Assistances/SportEvent.cs`; actualizar
      `SetEveDateTime`/`SetStartTime`/`SetEndTime` según design.md §1;
      `CreateNew(...)` acepta `DateTime? eveDateTime, DateTime? startTime`.
- [x] 1.3 Actualizar `Domain/Models/EventModel.cs` (`EveDateTime`/`StartTime` a
      `DateTime?`) para que el constructor privado `SportEvent(EventModel)` siga
      compilando.
- [x] 1.4 `dotnet build` — confirmar que solo fallan (con errores de compilación) los
      archivos listados en la sección 3 de este documento; `dotnet test --filter
      SportEventTests` en verde (GREEN).

## 2. Backend — `CreateSportEvent`: fecha/hora opcional + recurrencia requiere fecha

- [x] 2.1 Escribir tests (RED) en
      `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/CreateSportEventValidatorTests.cs`
      (extender el archivo existente):
      - Request con `EveDateTime: null`, `StartTime: null`, sin `Recurrence` → válido.
      - Request con `EveDateTime: null` y `Recurrence` presente → inválido (mensaje
        "La recurrencia requiere una fecha de evento").
      Confirmar que fallan (la clase `CreateSportEventValidator` aún no tiene la regla,
      y `CreateSportEventRequest.EveDateTime` aún no es `DateTime?` — este paso puede
      solaparse con 2.2 si el compilador bloquea antes; documentar cuál ocurre).
- [x] 2.2 Cambiar `CreateSportEventRequest.EveDateTime` a `DateTime?`; añadir la regla
      `RuleFor(x => x.EveDateTime).NotNull().When(x => x.Recurrence is not null)` en
      `CreateSportEventValidator` (design.md §2). Ajustar `BeWithinInstanceCap` y las
      reglas de `Recurrence.EndDate` que hoy comparan contra `x.EveDateTime` (ahora
      nullable) — usar `x.EveDateTime!.Value` dentro del bloque `When(x =>
      x.Recurrence is not null, ...)` (la regla de NotNull en el mismo `When` ya lo
      garantiza en tiempo de validación, pero FluentValidation evalúa todas las reglas
      del bloque independientemente del resultado de las demás, así que usar
      `x.EveDateTime.GetValueOrDefault()` para las comparaciones de fecha si `NotNull`
      aún no ha fallado — verificar con los tests de 2.1/2.2 que no lanza NRE en el
      caso `EveDateTime: null` + `Recurrence` presente).
- [x] 2.3 En el handler (`CreateSportEvent.AddRoutes` lambda): resolver
      `eveDateTimeUtc`/`startTimeUtc` como `DateTime?` (design.md §1/§2); el bloque
      `if (req.Recurrence is not null)` usa
      `ev.EveDateTime ?? throw new InvalidOperationException("Recurrence sin EveDateTime tras validación")`
      al construir `RecurrenceScheduler.GenerateDates(...)` (invariante garantizado por
      el validador, no un `.Value` silencioso).
- [x] 2.4 `dotnet build` + `dotnet test --filter CreateSportEventValidatorTests` en
      verde.

## 3. Backend — Rival inline en `CreateSportEvent`

- [x] 3.1 Escribir tests (RED):
      - `CreateSportEventValidatorTests`: request con `RivalId` y `NewRival` ambos
        presentes → inválido; request con `NewRival.Name` vacío → inválido; request con
        solo `NewRival` válido → válido; request sin `RivalId` ni `NewRival` → válido
        (evento sin rival).
      - Nuevo test de integración (o extensión de
        `SportEventsPushNotificationWiringTests.cs`/nuevo archivo
        `CreateSportEventInlineRivalTests.cs` en `IntegrationTests/`, patrón
        `EventRecurrencePersistenceTests.cs` contra Postgres real): `POST
        /api/sport-events` con `newRival: { name, urlPhoto, category }` crea un `Rival`
        nuevo y el `SportEvent` resultante tiene `RivalId` apuntando a ese rival.
      Confirmar que fallan.
- [x] 3.2 Añadir `NewRivalRequest` y el campo `NewRival` a `CreateSportEventRequest`;
      añadir las reglas de validación de la sección 4 de design.md a
      `CreateSportEventValidator`.
- [x] 3.3 Implementar la resolución de rival en el handler (design.md §4): crear +
      `db.Rivals.Add(rival)` cuando `NewRival` está presente, resolver `RivalId`
      existente cuando no, `null` cuando ninguno.
- [x] 3.4 `dotnet build` + `dotnet test --filter CreateSportEvent` en verde (GREEN).
- [x] 3.5 (Fix post-implementación) `CreateSportEvent.AddRoutes` no invalidaba la
      caché `"Rivals"` (EasyCaching, TTL 1h) tras crear un rival inline via `NewRival`,
      a diferencia de `CreateRival.cs`/`UpdateRival.cs`/`DeleteRival.cs`, que sí lo
      hacen. Efecto: `GET /api/rivals` seguía sirviendo la lista cacheada sin el rival
      recién creado hasta que expiraba la caché, y el desplegable de rival del
      formulario de edición del evento aparecía sin selección. Test de regresión (RED
      → GREEN) en
      `CreateSportEventInlineRivalTests.CreateSportEvent_WithNewRival_InvalidatesRivalsCacheSoGetRivalsIncludesIt`;
      fix: inyectar `IEasyCachingProviderFactory` en el endpoint y llamar
      `cache.RemoveAsync("Rivals", ct)` tras el primer `SaveChangesAsync`, solo cuando
      `req.NewRival is not null` (mismo patrón que `SyncCalendarFromFederation.cs`).

## 4. Backend — wiring del validador en el endpoint

- [x] 4.1 Escribir test de integración (RED) que llame al endpoint real `POST
      /api/sport-events` con un payload inválido (p.ej. `Name` vacío, o `RivalId` +
      `NewRival` ambos presentes) y confirme `400 ValidationProblemDetails` — hoy este
      test fallaría porque el validador no está conectado (confirmar que efectivamente
      falla contra el código actual antes de tocarlo).
- [x] 4.2 Registrar `services.AddScoped<FluentValidation.IValidator<CreateSportEventRequest>, CreateSportEventValidator>();`
      en `DependencyInjection/ServiceCollectionExtensions.cs` (mismo bloque/patrón que
      News/PushNotifications, con comentario explicando el motivo — design.md §5).
- [x] 4.3 Modificar la lambda de `CreateSportEvent.AddRoutes` para inyectar
      `IValidator<CreateSportEventRequest>`, llamar `ValidateAsync` y devolver
      `Results.ValidationProblem(validation.ToDictionary())` si falla, antes de
      cualquier otra lógica.
- [x] 4.4 `dotnet build` + `dotnet test` (suite completa de `SportEvent*`) en verde.

## 5. Backend — EF configuration + migración

- [x] 5.1 Actualizar `SportEventEntityConfiguration.cs`:
      `builder.Property(se => se.EveDateTime).IsRequired(false);` y lo mismo para
      `StartTime` (design.md §6).
- [x] 5.2 Generar migración desde `Back/ExtractionApi`:
      `.\manage-migrations.ps1` (o `dotnet ef migrations add
      MakeEventDateTimeAndStartTimeNullable --startup-project src/RFFM.Host --project
      src/RFFM.Api` si el script pide parámetros) — commit en un commit separado del
      código de aplicación (regla git.md §4.2, pero el commit en sí lo gestiona el
      usuario).
- [x] 5.3 Revisar el `Up()`/`Down()` generado — confirmar que solo altera
      `IsNullable` en las dos columnas, sin pérdida de datos.

## 6. Backend — `UpdateSportEvent` y consumidores downstream (compilación + no-regresión)

- [x] 6.1 `UpdateSportEvent.cs`: confirmar que compila sin cambios de comportamiento
      (asignar `DateTime`/`DateTime` a propiedades ahora `DateTime?` es válido por
      conversión implícita) — si el compilador exige un ajuste (p.ej. por el uso de
      `req.EveDateTime` en un contexto que infiere no-nulo), aplicar el cambio mínimo
      documentado en design.md ("Non-Goals": no relajar su validación).
- [x] 6.2 Corregir cada consumidor listado en design.md §7 (uno por uno, compilando
      tras cada cambio):
      - `GetTrainingAttendanceSummary.cs`
      - `GetEventConvocations.cs`
      - `GetEventPlayers.cs`
      - `SeasonPrepExportPdf.cs`
      - `SyncCalendarFromFederation.cs`
      - `GetPlayerSeasonCards.cs`
      - `GetSportEvents.cs` / `GetSportEventItem.cs` (respuestas `DateTime?`)
- [x] 6.3 Ejecutar los tests existentes de cada handler tocado (`dotnet test --filter
      GetTrainingAttendanceSummary|GetEventConvocations|GetEventPlayers|SeasonPrepExportPdf|SyncCalendarFromFederation|GetPlayerSeasonCards|GetSportEvents`)
      y confirmar verde sin regresión (los tests existentes cubren eventos con fecha,
      que es el caso que debe seguir comportándose igual).

## 7. Verificación final (Backend)

- [x] 7.1 `dotnet build` completo sin errores ni warnings nuevos.
- [x] 7.2 `dotnet test` completo — sin regresiones nuevas respecto al baseline previo
      al change (anotar cualquier fallo preexistente no relacionado, como en el
      ejemplo de `attendance-summary-bulk-convocations/tasks.md`).
- [x] 7.3 `openspec validate nullable-event-datetime-and-inline-rival --strict` sin
      errores.
- [x] 7.4 Marcar en este `tasks.md` qué tareas backend quedaron completas, dejando las
      de la sección 8 (Frontend) pendientes para `front-specialist`.

## 8. Frontend — formulario de creación de evento (Frontend — front-specialist)

- [x] 8.1 (Frontend — front-specialist) Actualizar el tipo `CreateSportEventRequest`
      en el servicio de eventos de Coach (`apps/coach/services/sportEventService.ts` o
      equivalente) según el contrato de design.md ("Frontend Contract").
- [x] 8.2 (Frontend — front-specialist) Formulario de creación de evento
      (`/coach/attendance?teamId=`): fecha/hora dejan de ser obligatorias en el
      formulario; añadir modo "rival nuevo" (nombre obligatorio, foto/categoría
      opcionales) junto al selector de rival existente, mutuamente excluyentes en la
      UI; deshabilitar/ocultar la opción de recurrencia mientras no haya fecha
      seleccionada.
- [x] 8.3 (Frontend — front-specialist) Vistas que muestran `eveDateTime`/`startTime`
      de un evento (listado, detalle, calendario) añaden un fallback "Por confirmar" /
      "Sin fecha" cuando el valor es `null`.
- [x] 8.4 (Frontend — front-specialist) Tests Vitest (RED → GREEN) para 8.1–8.3 según
      `.claude/rules/frontend-testing.md`.
- [x] 8.5 (Frontend — front-specialist) `npm run build` + `npm run test` en verde.
