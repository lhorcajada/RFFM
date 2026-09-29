## 1. Dominio (backend, TDD)

- [x] 1.1 Red: `UnitTests/RffmRoundRefreshPolicyTests.cs` — nunca sincronizada; sin hora (5 h → None,
      7 h → MissingSchedule); 80' iniciado a las 12:30 a las 14:05 → AwaitingResult; 90' a la misma
      hora → None; umbral de 10 min; fin hace >48 h → 24 h; próximo en 7 días → UpcomingRecheck
      a las 24 h; acta cerrada → None; cálculo en hora de Madrid.
- [x] 1.2 Red: `UnitTests/RffmRoundTests.cs` — `ApplySnapshot` crea partidos, parsea fecha/hora
      ("" → null), no marca cambios si nada cambia, devuelve `NewlyFinalRecordCodes` solo en la
      transición a acta cerrada, fija `LastSyncedAt`, conserva el orden (`SortOrder`) y no borra nada ante una jornada vacía.
- [x] 1.3 Green: `RffmCompetitionGroup`, `RffmRound`, `RffmMatch`, `RffmMatchRecord`, `RffmMatchSnapshot`,
      `RoundRefreshReason`, `RffmRoundRefreshPolicy`, `RffmOptions.Results`.

## 2. Persistencia

- [x] 2.1 Configuraciones EF (`jsonb` para `StandingsJson`/`PayloadJson`, índices únicos) y `DbSet`s
      en `FederationDbContext`; `dotnet build`.
- [x] 2.2 Migración `AddRffmResults` (FederationDbContext) — **commit separado**.

## 3. Mapeo y cliente RFFM (backend, TDD)

- [x] 3.1 Red: `UnitTests/RffmMatchDayMapperTests.cs` — `CalendarRffm` fixture → snapshot → entidad →
      respuesta idéntica a `CalendarService.GetCalendarMatchDayAsync` (escudos, fecha, hora, goles,
      posiciones desde `StandingsJson`, rondas).
- [x] 3.2 Green: `RffmMatchDayMapper`; `IRffmResultsClient`/`RffmResultsClient` (cliente
      `"RffmResults"`, 10 s); `CompetitionRffm.numero_partes`;
      `IRffmBackgroundClient.GetStandingsAsync` (y `FakeRffmBackgroundClient`).

## 4. Sincronización (backend, TDD, Postgres)

- [x] 4.1 Red: `IntegrationTests/RffmResultsSyncServiceTests.cs` con un `IRffmResultsClient` fake:
      primera consulta crea el grupo, las jornadas y los partidos (1 `results` + 1 `competitions`);
      segunda consulta con datos completos → 0 llamadas; sin hora a las 7 h → 1 llamada y la hora
      guardada; partido terminado sin acta → 1 llamada y resultado guardado; la RFFM lanza una
      excepción → se sirve la BD; 2 consultas concurrentes → 1 llamada; acta nueva → jobs
      `FetchMatchRecord` + `RefreshStandings` encolados.
- [x] 4.2 Green: `IKeyedLock`, `IRffmResultsSyncService`, `IRffmResultsJobQueue`.
- [x] 4.3 Red/Green: `IntegrationTests/RffmResultsWorkerTests.cs` — guarda el acta en `jsonb`, es
      idempotente, actualiza la clasificación y al arrancar encola las actas pendientes.
      `RffmResultsWorker` + registro en DI.

## 5. Endpoints (backend, TDD)

- [x] 5.1 Red/Green: `GetCalendarMatchDay` delega en el servicio (IRequest, `Season`); test de
      endpoint con la forma de la respuesta sin cambios y round ≤ 0 → 400 ProblemDetails.
- [x] 5.2 Red/Green: `ActaService` (usado por `GetActa`) devuelve el acta guardada sin llamar a la RFFM y guarda las actas
      cerradas descargadas.

## 6. Verificación

- [x] 6.1 `cd Back/ExtractionApi && dotnet build && dotnet test` en verde.
- [x] 6.2 Frontend sin cambios (el contrato de `GET /calendar/matchday` se mantiene); no aplica.
- [x] 6.3 Prueba manual contra la RFFM: abrir Resultados de un equipo real dos veces y comprobar en
      el log que la segunda no llama a la RFFM, y que las actas y la clasificación se guardan.
      _29/09: verificado a nivel de servicio con los clientes reales y Postgres en contenedor (grupo
      26738048, jornada 1): 1ª consulta 883 ms, 2ª 4 ms sin llamadas a la RFFM; duración 80'×2 leída
      de la RFFM; 8 actas + 1 clasificación encoladas; posiciones rellenas tras la clasificación; acta
      guardada (13 KB). Queda pendiente la revisión en la UI con la app arrancada._
- [x] 6.4 `openspec validate persist-rffm-results --strict` sin errores.
