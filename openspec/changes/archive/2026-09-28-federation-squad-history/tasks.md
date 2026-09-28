## 1. Parsers RFFM extraídos (backend, TDD)

- [x] 1.1 Red: `UnitTests/Federation/PlayerSheetParserTests.cs` y `ActaParserTests.cs` con HTML
      fixture (`__NEXT_DATA__`): participaciones, totales, tarjetas 100/101/102, alineaciones,
      goles y tarjetas por `codjugador`; HTML sin `__NEXT_DATA__` → `null`.
- [x] 1.2 Green: `PlayerSheetParser`, `ActaParser`; `PlayerService`/`ActaService` delegan en ellos.
- [x] 1.3 `dotnet test` en verde (sin regresiones en `GetPlayerSeasonTests`, `GetActaSeasonTests`).

## 2. Cliente RFFM resiliente (backend, TDD)

- [x] 2.1 Red: `RffmThrottlingHandlerTests` (nunca hay 2 peticiones en paralelo; pausa ≥ mínimo) y
      test de pipeline con un handler fake 503→200 (reintenta) y 404 (no reintenta).
- [x] 2.2 Green: paquete `Microsoft.Extensions.Http.Resilience`, `RffmThrottlingHandler`, cliente
      `"RffmBackground"`, `RffmOptions.BackgroundMinDelayMs`, `IRffmBackgroundClient`.

## 3. Dominio y persistencia (backend, TDD)

- [x] 3.1 Red: tests de `SquadHistoryReport` (Create, Subscribe idempotente, RequestRefresh por
      estado, Complete reemplaza entradas, Fail).
- [x] 3.2 Green: entidades, SmartEnums, configuraciones EF, `DbSet`s en `FederationDbContext`.
- [x] 3.3 Migración `AddSquadHistory` (FederationDbContext) — **commit separado**.

## 4. Generación (backend, TDD)

- [x] 4.1 Red: `SquadHistoryActaAggregatorTests` (convocado/titular/goles/amarillas/rojas+doble
      amarilla desde actas fixture).
- [x] 4.2 Red: `SquadHistoryGeneratorTests` con `IRffmBackgroundClient` fake y Postgres
      (testcontainers): 1 equipo → PlayerSheet; 2 equipos → Actas; acta compartida pedida 1 vez;
      jugador que falla → `IsIncomplete`; roster falla → `Failed`; notificaciones creadas y
      `Notified = true`.
- [x] 4.3 Green: `SquadHistoryActaAggregator`, `SquadHistoryGenerator`.
- [x] 4.4 Green: `ISquadHistoryQueue`, `SquadHistoryWorker` (reencola Pending/Running al arrancar),
      con registro en DI. Test: informe `Running` en BD → se reencola al iniciar.

## 5. Endpoints (backend, TDD)

- [x] 5.1 Red: `SquadHistoryEndpointTests` + `RequestSquadHistoryValidatorTests` (inexistente→202+encolado; Completed→200 sin
      encolar; Running→202 sin reencolar y suscribe; refresh→202; sin auth→401; validación→400;
      GET: 404 ProblemDetails; 200 agrupado por jugador/temporada).
- [x] 5.2 Green: `RequestSquadHistory.cs`, `GetSquadHistory.cs` (+ `Validator`).
- [x] 5.3 `dotnet build` y `dotnet test` en verde.

## 6. Notificaciones en Federación (frontend, TDD)

- [x] 6.1 Mover `notificationService.ts` a `shared/services/` y actualizar imports de Coach;
      `npm run test` de Coach en verde.
- [x] 6.2 Red: `AppHeader.federationNotifications.test.tsx` — campana solo en `/federation`,
      badge de no leídas y clic → `markNotificationRead` + navegación a `deepLinkPath`.
- [x] 6.3 Green: `shared/components/ui/FederationNotificationsBell/` (+ CSS Module, tests propios) usada en `AppHeader.tsx`.

## 7. Botón y página de historial (frontend, TDD)

- [x] 7.1 Red: `Squad/components/__tests__/SquadHistoryButton.test.tsx` — 200 → navega; 202 → snackbar.
- [x] 7.2 Green: `squadHistoryService.ts`, `SquadHistoryButton.tsx` y su uso en `GetPlayers.tsx`.
- [x] 7.3 Red: `SquadHistory/__tests__/SquadHistory.test.tsx` — tarjetas por jugador/temporada/
      equipo con todos los campos, chip de origen, "—" para `null`, 404 → "Generar historial",
      Running → alerta de progreso con datos previos, "Actualizar" → `refresh: true`, buscador.
- [x] 7.4 Green: `SquadHistory.tsx` (+ componentes y CSS Modules), ruta lazy en `routes.tsx`.

## 8b. Posibles jugadores y año de nacimiento (backend, TDD)

- [x] 8b.1 Red/Green: `FootballCategoryTests` — años por categoría y temporada, categoría inferior,
      detección por texto (tildes, femenino, no soportadas).
- [x] 8b.2 Red/Green: `ClubSheetParserTests`; `ClubDirectoryService` delega en el parser.
- [x] 8b.3 Red/Green: `RffmBackgroundClient` — `GetClubTeamsAsync`, `GetCompetitionsAsync`,
      `GetGroupsAsync`, `GetGroupRoundTeamsAsync`.
- [x] 8b.4 Red/Green: `SquadCandidateFinderTests` — filtro por años y categoría inferior, sexo,
      respaldo por grupos con emparejamiento por nombre de club, categoría no soportada.
- [x] 8b.5 Red/Green: dominio (`IsCandidateSquad`, `CandidateSearchNote`, `BirthYear`,
      `OriginTeamName`) y generador (plantilla vacía → candidatos; año de nacimiento en entradas;
      ficha previa reutilizada). Regenerar migración `AddSquadHistory` (no publicada).
- [x] 8b.6 Red/Green: `GetSquadHistory` expone `isCandidateSquad`, `candidateSearchNote`,
      `birthYear`, `originTeamName`.

## 8c. Posibles jugadores y año de nacimiento (frontend, TDD)

- [x] 8c.1 Red/Green: tarjeta muestra "Nacido en {año}" y "Procede de {equipo}"; la página muestra
      el aviso de plantilla vacía con posibles jugadores y la nota de búsqueda.

## 8. Verificación

- [x] 8.1 `cd Front && npm run test` y `npm run build` en verde.
- [x] 8.2 `cd Back/ExtractionApi && dotnet build && dotnet test` en verde.
- [x] 8.3 Prueba manual contra la RFFM con una plantilla real: tiempo total, ausencia de 429 y
      notificación recibida. Con un equipo sin jugadores: comprobar que `fichaclub?temporada=`
      devuelve los equipos de la temporada anterior (o que entra el respaldo por grupos) y que los
      posibles jugadores son correctos. Revisión visual a ~375px y en escritorio.
      _28/09: FEPE GETAFE III 'D' completo en ~6 min, sin 429. `fichaclub`/`fichaequipo` ignoran
      `temporada` → candidatos desde las 2 últimas actas; U.D. MOSTOLES BALOMPIE 'C' propone 73
      jugadores (2011 de cadetes, 2012 de infantiles) en ~7 min. Revisión visual a cargo del usuario._
- [x] 8.4 `openspec validate federation-squad-history --strict` sin errores.
