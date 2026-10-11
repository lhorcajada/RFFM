## 0. Código RFFM del equipo (backend + frontend, TDD)

- [x] 0.1 Red→Green: `Team.UpdateRffmTeamCode`, `UpdateTeamCompetition` (comando, validador,
      borra el código si falta competición o grupo), `GetTeam`/`TeamModelBase` lo exponen.
- [x] 0.2 Migración `AddRffmTeamCodeToTeam` (`AppDbContext`) — **commit separado**.
- [x] 0.3 Red→Green: selector «Equipo RFFM» (equipos del grupo; se vacía al cambiar competición
      o grupo) y `EditTeam.tsx` enviando `rffmTeamCode`. Implementado como componente aparte
      `RffmTeamSelect` en vez de ampliar `RffmCompetitionSelect`, para no cambiar el contrato
      `{ competitionId, groupId }` que ya usan sus tests.

## 1. Dominio y persistencia (backend, TDD)

- [x] 1.1 Red: `UnitTests/LeagueSquadStatsReportTests.cs` — `Create` (Pending), `RequestRefresh`
      por estado, `CanRefresh` con intervalo mínimo, `Start`/`SetTotals`/`RegisterPlayerProcessed`,
      `ReplaceSquads` sustituye equipos y jugadores, `Complete` fija `CompletedAt`, `Fail`
      conserva equipos y `CompletedAt` anteriores, `Subscribe` idempotente y
      `TakePendingNotifications` devuelve cada suscriptor una sola vez.
- [x] 1.2 Red: `UnitTests/RffmPlayerSeasonStatsTests.cs` — `Create`/`Update` desde `Player`,
      `HasActivity` false con ficha sin convocatorias ni competiciones, participaciones serializadas.
- [x] 1.3 Green: entidades y SmartEnum en `Domain/Entities/Federation/LeagueSquadStats/`,
      configuraciones EF, `DbSet`s en `FederationDbContext`.
- [x] 1.4 Migración `AddLeagueSquadStats` (`FederationDbContext`) — **commit separado**.
- [x] 1.5 `dotnet build` y `dotnet test` en verde.

## 2. Generación (backend, TDD)

- [x] 2.1 Red: `UnitTests/LeagueSquadStatsGeneratorTests.cs` con `IRffmBackgroundClient` fake:
      primera generación pide las dos temporadas; actualización solo la actual; jugador nuevo
      pide ambas; jugador que desaparece sale del equipo; ficha `null` se reintenta una vez;
      ficha actual fallida conserva la fila previa y cuenta como fallido; ficha pasada `null` no
      guarda fila; sin equipos del grupo → `Failed` conservando datos; progreso persistido;
      notifica a los suscriptores al completar y al fallar, y a nadie si no hay suscriptores.
- [x] 2.1b Red→Green: `IWebPushNotificationDispatcher.DispatchRivalStatsFinishedAsync`.
- [x] 2.2 Green: `Features/Federation/LeagueSquadStats/Services/LeagueSquadStatsGenerator.cs`.
- [x] 2.3 Red→Green: `ILeagueSquadStatsQueue` + `LeagueSquadStatsWorker` (reencola
      Pending/Running al arrancar; un fallo no detiene el worker) y registro en DI.

## 3. Planificación semanal (backend, TDD)

- [x] 3.1 Red: `UnitTests/WeeklyScheduleTests.cs` — `NextRun`/`LastRun` para lunes 00:01
      Europe/Madrid: antes y después de la hora, en lunes, en fin de semana y en los dos cambios
      de hora.
- [x] 3.2 Red: `LeagueSquadStatsScheduleServiceTests.cs` — encola las ligas de los equipos de
      Coach con competición; crea el informe si no existe; una liga compartida por dos equipos
      se encola una vez; ignora informes de ligas sin equipo de Coach, los que están en curso y
      los ya actualizados después de `dueBefore`.
- [x] 3.3 Green: `WeeklySchedule`, `LeagueSquadStatsScheduleService`, `LeagueSquadStatsScheduler`, opciones
      `RffmOptions.LeagueSquadStats` y registro en DI.

## 4. Endpoints (backend, TDD)

- [x] 4.1 Red: `RequestRivalStatsHandlerTests` + `RequestRivalStatsValidatorTests` — inexistente
      → Pending + encolado + suscrito; en curso → no reencola y suscribe; completado sin refresh → no encola; refresh
      permitido → encola; refresh demasiado reciente → no encola y devuelve
      `NextRefreshAllowedAt`; equipo sin competición → conflicto.
- [x] 4.2 Red: `GetRivalStatsHandlerTests` y `GetRivalTeamStatsHandlerTests` — 404 sin informe;
      resumen con equipos, nº de jugadores y equipo propio marcado y el primero; jugadores con dos temporadas ordenados por partidos
      jugados; equipo ajeno al informe → 404.
- [ ] 4.3 `IntegrationTests/RivalStatsEndpointTests` (401/403 y códigos HTTP a nivel de endpoint)
      — **no hecho**: los handlers y el validador están cubiertos en `RivalStatsTests`, y 401/403
      dependen de `RequireAuthorization` y de los behaviors de permisos, que ya tienen sus tests.
- [x] 4.4 Green: `Features/Coaches/RivalStats/RequestRivalStats.cs`, `GetRivalStats.cs`,
      `GetRivalTeamStats.cs` (+ `Validator`).
- [x] 4.5 `dotnet build` y `dotnet test` en verde; versión de la API (minor) en
      `Directory.Build.props`.

## 5. Componente compartido de estadísticas (frontend, TDD)

- [x] 5.1 Red: `shared/components/ui/PlayerSeasonStats/__tests__/PlayerSeasonStats.test.tsx` —
      título de temporada, valores con sus etiquetas accesibles, equipos con puntos y posición.
- [x] 5.2 Green: `PlayerSeasonStats.tsx` (+ CSS Module) y `PlayerSeasonsDetail.tsx` usándolo;
      `PlayerSeasonsDetail.test.tsx` sigue en verde sin cambios.

## 6. Página Rivales (frontend, TDD)

- [x] 6.1 Red: `apps/coach/hooks/__tests__/useRivalStats.test.ts` — 404 → sin generar; sondeo
      mientras Pending/Running y parada al completar; `generate`/`refresh` llaman al servicio.
- [x] 6.2 Green: `services/rivalStatsService.ts`, `hooks/useRivalStats.ts`.
- [x] 6.3 Red: `pages/rivalStats/__tests__/RivalStats.test.tsx` — estado vacío con «Generar
      estadísticas»; progreso en curso; completado con fecha, «Actualizar» y equipos;
      «Actualizar» deshabilitado si es demasiado reciente; fallido con reintento; equipo sin
      competición; abrir un equipo carga y muestra sus jugadores con las dos temporadas; «Tu
      equipo» marcado; aviso si falta el código RFFM del equipo.
- [x] 6.4 Green: `RivalStats.tsx`, `components/RivalTeamCard.tsx`,
      `components/RivalPlayerCard.tsx` (+ CSS Modules), ruta lazy en `routes.tsx`.
- [x] 6.5 Red→Green: tarjeta «Rivales» en `TeamDashboardCards.tsx` (test de enlace con `teamId`).
- [x] 6.6 `npm run build` y `npm run test` en verde; versión de Front (minor) en `package.json`.
      **Pendiente:** revisión visual a ~360 px y en escritorio (no se ha abierto en navegador).

## 7. Verificación final

- [x] 7.1 `openspec validate coach-rival-squad-stats --strict` sin errores.
- [ ] 7.2 Prueba manual contra la RFFM real: generar una liga, comprobar progreso y tiempos,
      actualizar y verificar en el log que solo se piden fichas de la temporada actual.
- [ ] 7.3 Commits (`feat(mcp-api)`, migraciones aparte, `feat(front)`) tras confirmación.
