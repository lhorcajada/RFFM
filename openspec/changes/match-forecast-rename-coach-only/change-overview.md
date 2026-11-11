## Proposal

### Why

La página «Estadísticas de rivales» es una herramienta de pronóstico, no solo de estadísticas, y las acciones que generan o actualizan datos deben quedar reservadas a los entrenadores. Este cambio es el esqueleto (nombre, rutas y control de rol) del que dependen los demás cambios de la serie de pronóstico (issue #10).

### What Changes

- Renombrar la página «Estadísticas de rivales» como «Pronóstico de partidos» en el menú del equipo, el título, las rutas, los ficheros, los hooks, el servicio y los tests del frontend, y la carpeta del backend (`Features/Coaches/RivalStats/` pasa a `Features/Coaches/MatchForecast/`).
- Rutas del frontend `match-forecast` y `match-forecast/simulation`; las rutas antiguas `rival-stats` y `rival-stats/simulation` redirigen a las nuevas conservando la query string.
- Rutas de API `/api/teams/{teamId}/match-forecast/...` en lugar de `/api/teams/{teamId}/rival-stats/...`. **BREAKING**: las rutas de API antiguas dejan de existir, sin redirección; frontend y backend se despliegan juntos.
- El botón «Simulación» pasa a llamarse «Crear pronóstico».
- «Crear pronóstico», «Actualizar» y los controles que piden generar o reintentar las estadísticas solo se muestran al rol Coach, y el endpoint `POST .../match-forecast/requests` responde 403 con `ProblemDetails` a quien no tenga ese rol, sin encolar ninguna generación.
- Las notificaciones push nuevas usan el nombre «Pronóstico de partidos» (títulos «Pronóstico de partidos listo» y «No se pudo generar el pronóstico de partidos») y enlazan a la ruta nueva; los enlaces de notificaciones ya enviadas siguen funcionando gracias a la redirección.
- No cambia el cálculo ni los datos de las estadísticas. Mobile no cambia.

## Design

### Target State

Cuando el cambio esté completo, la página que antes era «Estadísticas de rivales» es «Pronóstico de partidos» en todo lugar donde un usuario o cliente pueda verla. La página web vive en `/coach/match-forecast` y su página de simulación en `/coach/match-forecast/simulation`; la API vive bajo `/api/teams/{teamId}/match-forecast/...`; las URLs web antiguas redirigen conservando la query string; las URLs de API antiguas desaparecen. Los controles de generar o actualizar y el endpoint `POST .../requests` pertenecen solo al rol Coach. El cálculo, los datos guardados y el esquema de base de datos no cambian.

### Goals / Non-Goals

Goals:

- El nombre, las rutas y los textos nuevos exactamente como los indica la spec `match-forecast`, en web, API y notificaciones.
- Las URLs web antiguas siguen funcionando mediante una redirección que conserva la query string; las URLs de API antiguas dejan de existir.
- Solo el rol Coach ve y usa las acciones de generar o actualizar, y la API rechaza a todos los demás antes de encolar ningún trabajo.
- Sin cambios en el cálculo, los datos guardados, el esquema ni las migraciones.

Non-Goals:

- Cambios en Mobile (Mobile no usa esta página).
- Fuera de alcance: restringir `PUT .../match-forecast/simulation/rounds` (sincronización de rondas) y los endpoints de lectura al rol Coach; revisarlo cuando la serie pida que los no entrenadores no puedan disparar ninguna escritura, teniendo en cuenta que la página de simulación llama a la sincronización al cargar para todos los miembros.
- Fuera de alcance: renombrar las entidades de base de datos, las claves de tipo de notificación, el valor de `RivalStatsConstants.Feature` o los nombres de tipo de los conceptos de datos que no cambian; revisarlo cuando un cambio posterior necesite un único nombre entre datos y pantallas.
- Fuera de alcance: restringir la ruta `/coach/match-forecast/simulation` al rol Coach; revisarlo cuando los no entrenadores no deban ver la simulación.

### Decisions

#### 1. Rename names of the page, route and files; keep names of the data concepts

Renombrado: la carpeta y el namespace del backend (`Features/Coaches/MatchForecast`), el segmento de ruta de la API, la carpeta y el componente de la página del frontend (`pages/matchForecast/MatchForecast`), el hook de la página (`useRivalStats` a `useMatchForecast`), el módulo de servicio (`rivalStatsService.ts` a `matchForecastService.ts`), la clave y la etiqueta del menú, y los tests que los ejercitan. Se mantienen: los nombres de tipo del backend como `RequestRivalStats`, `RivalStatsLeague` y `RivalStatsConstants.Feature`; los nombres de funciones y tipos exportados dentro del servicio (`getRivalStats`, `requestRivalStats`, tipos de respuesta); y la página, el hook y los componentes de simulación (`RivalSimulation*`, `useRivalSimulation`), que conservan sus nombres y se mueven bajo la nueva carpeta de la página. Los nombres que se mantienen describen datos que no cambian, y conservarlos mantiene el diff revisable como movimientos más los cambios de comportamiento reales.

**Provenance**: derived

#### 2. Coach-only API check inside the endpoint, answering `Results.Problem` 403

`RequestRivalStats` comprueba el rol `AppRoles.Coach.Name` del llamante en la lambda del endpoint, antes de enviar el comando al mediador, y devuelve `Results.Problem` con estado 403 (misma forma que `UpdateTeamPlayer`). `RequireAuthorization()` se mantiene, así que los llamantes anónimos siguen recibiendo 401. Como la comprobación se ejecuta antes del mediador, ningún informe se crea o modifica y no se encola ninguna generación para un llamante rechazado. Un `Administrator` sin el rol `Coach` queda rechazado porque la comprobación es una coincidencia exacta de rol, no `Roles = "Coach,Administrator"`. El comando conserva `IRequireFeaturePermission` e `IRequireTeamMembership`, así que un entrenador fuera del equipo sigue siendo rechazado por los behaviors existentes. Alternativa considerada: `RequireAuthorization(Roles = "Coach")` (precedente de `CreateTeamNote`); necesita menos código, pero no se verificó que su cuerpo 403 sea `ProblemDetails`, que exige la spec.

**Provenance**: derived

#### 3. Frontend Coach-only controls through a pure helper and a hook

`computeIsCoachRole(roles)` vive junto a `computeIsPlayerRole` en `isPlayerRole.ts` (nombrado en la propuesta) y compara los nombres de rol sin distinguir mayúsculas, como lo hace `coachAuthService.hasRole`. `useIsCoachRole()` envuelve la función sobre `coachAuthService.getRoles()` con la misma forma de lectura única que `useIsPlayerRole`. `MatchForecast.tsx` renderiza «Crear pronóstico», «Actualizar», «Generar estadísticas» y «Reintentar» solo cuando el hook devuelve true, y sigue mostrando el estado, los equipos y las estadísticas de jugadores a todos. La comprobación del backend (Decisión 2) es la autoridad; los controles ocultos son una capa de usabilidad.

**Provenance**: user

#### 4. Redirects keep the query string through a small component

`RedirectKeepingSearch` renderiza `<Navigate to={{ pathname: to, search: location.search }} replace />`. `routes.tsx` declara `rival-stats` y `rival-stats/simulation` con él, fuera de `RequireFeaturePermission`, de modo que la guarda de la nueva ruta decide el acceso tras la redirección. `teamNavRoutes.ts` lista solo la ruta nueva, ya que la antigua nunca permanece montada. El id del equipo viaja en la query string, así que la redirección conserva la selección de equipo y los enlaces push antiguos siguen funcionando.

**Provenance**: derived

#### 5. Old API routes are removed, not redirected

Los seis endpoints cambian el literal de ruta de `rival-stats` a `match-forecast`. No quedan alias ni redirecciones; web y API se despliegan juntos. La base URL del servicio del frontend cambia en el mismo cambio.

**Provenance**: user

#### 6. Notification text and link change, type keys stay

`DispatchRivalStatsFinishedAsync` recibe los nuevos títulos y el nuevo enlace. `RivalStatsReady` y `RivalStatsFailed` mantienen sus valores porque son identificadores persistidos que los registros existentes y los clientes pueden leer. Las notificaciones ya enviadas conservan su enlace antiguo, que resuelve la redirección web.

**Provenance**: derived

#### 7. Version bumps

El cambio añade comportamiento solo para Coach y renombra rutas públicas, así que es un `feat`: la `<Version>` de la API pasa de 1.51.0 a la siguiente versión menor y la versión web de `Front/package.json` pasa de 1.116.2 a 1.117.0 mediante `npm version 1.117.0 --no-git-tag-version`. Un bump mayor necesita el acuerdo del usuario y no se dio ninguno.

**Provenance**: codebase-forced

### Risks / Trade-offs

- [Un cliente fuera de la app web sigue llamando a `/api/teams/{teamId}/rival-stats/...` y se rompe] → Mobile y la suite e2e web no mostraron referencias; el servicio web se actualiza en el mismo cambio, y ambos se despliegan juntos.
- [Ficheros renombrados a mano dejan un import obsoleto o un nombre de test desactualizado] → Actualizar cada importador listado en Context en el mismo paso que el movimiento; `dotnet build` y `npm run build` fallan ante cualquier fallo.
- [La clave persistida `RivalStats` del tag `Feature` y las claves de tipo de notificación parecen inconsistentes junto al nuevo nombre de carpeta] → Se mantienen a propósito (Decisión 6, Non-Goals); un cambio posterior puede renombrarlas con una decisión de datos.
- [Un usuario no Coach mantiene una página marcada o en caché que sigue mostrando los controles hasta que se leen los roles] → La API rechaza la petición con 403 `ProblemDetails`, así que no cambian datos.
- [La página de simulación sigue llamando a la sincronización de rondas para no entrenadores, lo que escribe simulaciones guardadas] → Documentado como non-goal; el endpoint sigue siendo idempotente y el acceso no cambia.

### Open Questions

Ninguna.

### Manual Verification

- Deriva de artefactos generados: `None` — sin cambios de migración, snapshot, fichero diseñador ni lockfile versionado; el `Front/package-lock.json` sin seguimiento no forma parte del cambio.
- Prueba de humo end-to-end en runtimes reales: como Coach, abrir el menú del equipo, entrar en «Pronóstico de partidos», pulsar «Generar estadísticas» y esperar la push; el título de la notificación dice «Pronóstico de partidos listo» y su enlace abre `/coach/match-forecast?teamId=<id>`. Después abrir `/coach/rival-stats?teamId=<id>` y confirmar que la barra de direcciones pasa a `/coach/match-forecast?teamId=<id>` con el mismo equipo. Como Player, abrir la misma página y confirmar que los datos se muestran y que no aparece ninguno de los cuatro controles reservados a Coach.

## Step 1: Backend rename to `MatchForecast`, Coach-only `POST .../requests` and API version bump

### Interfaces

**Interfaces**:
- Endpoint `POST api/teams/{teamId}/match-forecast/requests` (tipo `RequestRivalStats`): la lambda comprueba los roles del llamante contra `AppRoles.Coach.Name` (exacto, sin distinguir mayúsculas) antes de `mediator.Send`; si falla, devuelve `Results.Problem(statusCode: StatusCodes.Status403Forbidden, title: "Solo un entrenador puede generar o actualizar el pronóstico de partidos", extensions: { ["code"] = ErrorCodes.MatchForecastRequestForbidden })`. Los parámetros de la lambda, `RequestRivalStatsBody`, `RequestRivalStatsCommand` y `Handler` no cambian.
- Nueva constante `ErrorCodes.MatchForecastRequestForbidden` (string), declarada junto a `ErrorCodes.TeamPlayerEditForbidden` y siguiendo su estilo de nombre y valor.
- Clase de test `RequestRivalStatsAuthorizationTests` (`[Collection(PostgresCollection.Name)]`, `TestAuthHandler` anidado que lee la cabecera `X-Test-Role` en `ClaimTypes.Role`, y un sustituto de `IMediator` que cuenta las llamadas a `Send`).
- Namespace `RFFM.Api.Features.Coaches.MatchForecast` (y `RFFM.Api.Features.Coaches.MatchForecast.Services`) reemplaza a `RFFM.Api.Features.Coaches.RivalStats` para los diez ficheros movidos; cada tipo público conserva su nombre (`RequestRivalStats`, `GetRivalStats`, `GetRivalTeamStats`, `GetRivalSimulation`, `GetRivalSimulationHistory`, `SyncRivalSimulationRounds`, `RivalStatsLeague`, `RivalStatsConstants`, `RivalRoundSimulationService`, `RivalSimulationInputLoader`).
- Literales de ruta (cada `IFeatureModule.AddRoutes` conserva método, subruta y `.RequireAuthorization()`):
  - `GET api/teams/{teamId}/match-forecast`
  - `GET api/teams/{teamId}/match-forecast/teams/{teamCode}`
  - `POST api/teams/{teamId}/match-forecast/requests`
  - `GET api/teams/{teamId}/match-forecast/simulation`
  - `GET api/teams/{teamId}/match-forecast/simulation/rounds`
  - `PUT api/teams/{teamId}/match-forecast/simulation/rounds`
- `IWebPushNotificationDispatcher.DispatchRivalStatsFinishedAsync` y `RivalStatsRecipient` mantienen sus firmas; solo cambia el texto que construye.
- `Directory.Build.props` `<Version>` `1.52.0`.
- Servicio web `rivalStatsService` (el módulo se renombra en el Step 3): cada URL de petición usa desde este paso la base `/api/teams/${teamId}/match-forecast`.
- Clase de test `MatchForecastRoutesTests` (xUnit, `[Collection(PostgresCollection.Name)]`, mismo patrón de `TestServer` más `TestAuthHandler` anidado que `TeamNotesEndpointAuthorizationTests`).

**Test assertions**:
- Un miembro del equipo llama a `GET /api/teams/{teamId}/match-forecast` → la petición se enruta a `GetRivalStats` (el estado no es 404) y la forma del cuerpo es la que devolvía `GetRivalStats` por la ruta antigua. Anclaje: `openspec/changes/match-forecast-rename-coach-only/specs/match-forecast/spec.md` escenario «Ruta nueva disponible».
- Un cliente llama a `GET /api/teams/{teamId}/rival-stats` → estado 404, sin cabecera `Location`, sin redirección. Anclaje: `openspec/changes/match-forecast-rename-coach-only/specs/match-forecast/spec.md` escenario «Ruta antigua inexistente».
- `PUT` y `GET /api/teams/{teamId}/match-forecast/simulation/rounds` se enrutan (no 404) y las mismas rutas bajo `rival-stats` responden 404. Anclaje: `openspec/changes/match-forecast-rename-coach-only/specs/rival-simulation-history/spec.md` requisitos «Round synchronization endpoint» y «Simulation history with real results».
- `GET /api/teams/{teamId}/match-forecast/simulation` se enruta (no 404). Anclaje: `openspec/changes/match-forecast-rename-coach-only/specs/rival-match-simulation/spec.md` requisito «Rival simulation endpoint».
- `getRivalStats('t1')` pide `/api/teams/t1/match-forecast`; `requestRivalStats('t1')` hace POST a `/api/teams/t1/match-forecast/requests`; la simulación, la sincronización de rondas y el historial usan `/api/teams/t1/match-forecast/simulation` y `/simulation/rounds` (PUT y GET). Anclaje: `openspec/changes/match-forecast-rename-coach-only/specs/rival-simulation-history/spec.md` requisitos «Round synchronization endpoint» y «Simulation history with real results».
- `WebPushNotificationDispatcher.DispatchRivalStatsFinishedAsync` para una generación correcta → título `Pronóstico de partidos listo` y enlace `/coach/match-forecast?teamId=<teamId>`. Anclaje: `openspec/changes/match-forecast-rename-coach-only/specs/coach-rival-squad-stats/spec.md` escenario «Generación completada».
- El mismo método para una generación fallida → título `No se pudo generar el pronóstico de partidos`, mismo enlace, y clave de tipo todavía `RivalStatsFailed` (el éxito conserva `RivalStatsReady`). Anclaje: `openspec/changes/match-forecast-rename-coach-only/specs/coach-rival-squad-stats/spec.md` escenario «Generación fallida».
- Los tests de handler existentes (`RivalStatsTests`, `RivalSimulationTests`, `RivalSimulationHistoryTests`, `RivalRoundSimulationServiceTests`) mantienen cada valor de aserción sin cambios tras solo cambiar sus `using`. Anclaje: `openspec/changes/match-forecast-rename-coach-only/specs/match-forecast/spec.md` escenario «El cálculo no cambia».
- Llamante con rol `Player` hace POST a `/api/teams/{teamId}/match-forecast/requests` → estado 403, cuerpo `ProblemDetails` con `status` 403, `title` igual a `Solo un entrenador puede generar o actualizar el pronóstico de partidos`, extensión `code` igual a `ErrorCodes.MatchForecastRequestForbidden`, y contador de `Send` del mediador en 0. Anclaje: `openspec/changes/match-forecast-rename-coach-only/specs/match-forecast/spec.md` escenario «Usuario sin rol Coach llama directamente al endpoint».
- Llamante solo con rol `Administrator` → estado 403, `ProblemDetails`, contador de `Send` en 0. Anclaje: `openspec/changes/match-forecast-rename-coach-only/specs/match-forecast/spec.md` escenario «Administrador sin rol Coach llama al endpoint».
- Llamante con rol `Coach` → el mediador registrado recibe exactamente un `RequestRivalStatsCommand` para el `teamId` de la ruta, y cuando el stub devuelve un informe con estado `Pending` (estado en curso) el endpoint responde 202; un stub que devuelva un informe completado daría 200, que este test no aserta. Anclaje: `openspec/changes/match-forecast-rename-coach-only/specs/match-forecast/spec.md` escenario «Entrenador llama al endpoint».
- Llamante con roles `Coach` y `Administrator` → mismo resultado que solo `Coach` (contador de `Send` en 1). Anclaje: `openspec/changes/match-forecast-rename-coach-only/specs/match-forecast/spec.md` requisito «El endpoint de actualización exige el rol Coach».
- Llamante anónimo → estado 401 y contador de `Send` en 0. Anclaje: `openspec/changes/match-forecast-rename-coach-only/specs/match-forecast/spec.md` requisito «El endpoint de actualización exige el rol Coach» (los controles de acceso existentes se mantienen).

### Tasks

**Files Affected**:
```text
R Back/ExtractionApi/src/RFFM.Api/Features/Coaches/RivalStats/GetRivalStats.cs -> Back/ExtractionApi/src/RFFM.Api/Features/Coaches/MatchForecast/GetRivalStats.cs
R Back/ExtractionApi/src/RFFM.Api/Features/Coaches/RivalStats/GetRivalTeamStats.cs -> Back/ExtractionApi/src/RFFM.Api/Features/Coaches/MatchForecast/GetRivalTeamStats.cs
R Back/ExtractionApi/src/RFFM.Api/Features/Coaches/RivalStats/RequestRivalStats.cs -> Back/ExtractionApi/src/RFFM.Api/Features/Coaches/MatchForecast/RequestRivalStats.cs
R Back/ExtractionApi/src/RFFM.Api/Features/Coaches/RivalStats/GetRivalSimulation.cs -> Back/ExtractionApi/src/RFFM.Api/Features/Coaches/MatchForecast/GetRivalSimulation.cs
R Back/ExtractionApi/src/RFFM.Api/Features/Coaches/RivalStats/GetRivalSimulationHistory.cs -> Back/ExtractionApi/src/RFFM.Api/Features/Coaches/MatchForecast/GetRivalSimulationHistory.cs
R Back/ExtractionApi/src/RFFM.Api/Features/Coaches/RivalStats/SyncRivalSimulationRounds.cs -> Back/ExtractionApi/src/RFFM.Api/Features/Coaches/MatchForecast/SyncRivalSimulationRounds.cs
R Back/ExtractionApi/src/RFFM.Api/Features/Coaches/RivalStats/RivalStatsLeague.cs -> Back/ExtractionApi/src/RFFM.Api/Features/Coaches/MatchForecast/RivalStatsLeague.cs
R Back/ExtractionApi/src/RFFM.Api/Features/Coaches/RivalStats/RivalSimulationContracts.cs -> Back/ExtractionApi/src/RFFM.Api/Features/Coaches/MatchForecast/RivalSimulationContracts.cs
R Back/ExtractionApi/src/RFFM.Api/Features/Coaches/RivalStats/Services/RivalRoundSimulationService.cs -> Back/ExtractionApi/src/RFFM.Api/Features/Coaches/MatchForecast/Services/RivalRoundSimulationService.cs
R Back/ExtractionApi/src/RFFM.Api/Features/Coaches/RivalStats/Services/RivalSimulationInputLoader.cs -> Back/ExtractionApi/src/RFFM.Api/Features/Coaches/MatchForecast/Services/RivalSimulationInputLoader.cs
M Back/ExtractionApi/src/RFFM.Api/DependencyInjection/ServiceCollectionExtensions.cs
M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/LeagueScorers/GetLeagueScorers.cs
M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/LeagueScorers/RefreshLeagueActas.cs
M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Notifications/Services/WebPushNotificationDispatcher.cs
M Back/ExtractionApi/Directory.Build.props
M Back/ExtractionApi/src/RFFM.Api/Domain/ErrorCodes.cs
M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/RivalSimulationSeeder.cs
M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/RivalStatsTests.cs
M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/RivalSimulationTests.cs
M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/RivalSimulationHistoryTests.cs
M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/RivalRoundSimulationServiceTests.cs
M Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/WebPushNotificationDispatcherTests.cs
A Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/MatchForecastRoutesTests.cs
A Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/RequestRivalStatsAuthorizationTests.cs
M Front/src/apps/coach/services/rivalStatsService.ts
M Front/src/apps/coach/services/__tests__/rivalStatsService.simulation.test.ts
```

## Step 2: Coach-only controls on the page and «Crear pronóstico» button text

### Interfaces

**Interfaces**:
- `computeIsCoachRole(roles: string[]): boolean` exportada desde el módulo `isPlayerRole`, junto a `computeIsPlayerRole`; devuelve true solo cuando algún rol es igual a `Coach` sin distinguir mayúsculas.
- `useIsCoachRole(): boolean` (exportación nombrada y por defecto), calculada una vez desde `coachAuthService.getRoles()` mediante `computeIsCoachRole`.
- Página `RivalStats` (todavía en su ruta actual en este paso): los cuatro controles `Crear pronóstico`, `Actualizar`, `Generar estadísticas`, `Reintentar` solo se renderizan cuando `useIsCoachRole()` es true; el enlace que antes se llamaba `Simulación` ahora se llama `Crear pronóstico`.

**Test assertions**:
- `computeIsCoachRole(['Coach'])` → true; `['coach']` → true; `['Coach', 'Administrator']` → true; `['Administrator']` → false; `['Player']` → false; `['FamilyMember']` → false; `[]` → false. Anclaje: `openspec/changes/match-forecast-rename-coach-only/specs/match-forecast/spec.md` escenario «Administrador sin rol Coach no ve los controles».
- `useIsCoachRole()` con `coachAuthService.getRoles` simulado como `['Coach']` → true; simulado como `['Player']` → false. Anclaje: `openspec/changes/match-forecast-rename-coach-only/specs/match-forecast/spec.md` requisito «Solo el rol Coach ve y usa las acciones que generan o actualizan el pronóstico».
- Página con rol Coach y un informe completado → botones `Crear pronóstico` y `Actualizar` presentes, y ningún enlace llamado `Simulación`. Anclaje: `openspec/changes/match-forecast-rename-coach-only/specs/match-forecast/spec.md` escenarios «Entrenador ve los controles» y «Botón de la simulación».
- Página con rol Player (o familiar) y un informe completado → lista de equipos y estadísticas de jugadores presentes, botones `Crear pronóstico` y `Actualizar` ausentes. Anclaje: `openspec/changes/match-forecast-rename-coach-only/specs/match-forecast/spec.md` escenario «Usuario sin rol Coach no ve «Crear pronóstico» ni «Actualizar»».
- Página solo con el rol `Administrator` y un informe completado → botones `Crear pronóstico` y `Actualizar` ausentes. Anclaje: `openspec/changes/match-forecast-rename-coach-only/specs/match-forecast/spec.md` escenario «Administrador sin rol Coach no ve los controles».
- Página con un rol que no es Coach y sin informe para la liga → estado vacío mostrado, botón `Generar estadísticas` ausente. Anclaje: `openspec/changes/match-forecast-rename-coach-only/specs/match-forecast/spec.md` escenario «Usuario sin rol Coach ante una liga sin estadísticas».
- Página con rol Coach y sin informe → botón `Generar estadísticas` presente. Anclaje: `openspec/changes/match-forecast-rename-coach-only/specs/coach-rival-squad-stats/spec.md` escenario «Sin estadísticas generadas».
- Página con un rol que no es Coach y un informe fallido → mensaje de error mostrado, botón `Reintentar` ausente; con rol Coach el botón está presente. Anclaje: `openspec/changes/match-forecast-rename-coach-only/specs/match-forecast/spec.md` escenario «Usuario sin rol Coach ante una generación fallida» y `openspec/changes/match-forecast-rename-coach-only/specs/coach-rival-squad-stats/spec.md` escenario «La última generación falló».
- Página con rol Coach cuya última actualización es demasiado reciente → botón `Actualizar` presente y deshabilitado. Anclaje: `openspec/changes/match-forecast-rename-coach-only/specs/coach-rival-squad-stats/spec.md` escenario «Actualización no disponible todavía».

### Tasks

**Files Affected**:
```text
M Front/src/apps/coach/hooks/isPlayerRole.ts
A Front/src/apps/coach/hooks/__tests__/isPlayerRole.test.ts
A Front/src/apps/coach/hooks/useIsCoachRole.ts
A Front/src/apps/coach/hooks/__tests__/useIsCoachRole.test.ts
M Front/src/apps/coach/pages/rivalStats/RivalStats.tsx
M Front/src/apps/coach/pages/rivalStats/__tests__/RivalStats.test.tsx
M Front/src/apps/coach/pages/rivalStats/__tests__/RivalStats.leagueSummary.test.tsx
```

## Step 3: Frontend rename to `matchForecast`, redirects of the old routes and web version bump

### Interfaces

**Interfaces**:
- `RedirectKeepingSearch(props: { to: string }): JSX.Element` — renderiza `<Navigate to={{ pathname: to, search: location.search }} replace />`; exportación por defecto.
- Módulo de página `MatchForecast` (exportación por defecto, antes `RivalStats`) en la nueva carpeta de página; la página de simulación `RivalSimulation` (exportación por defecto) no cambia de nombre ni de props.
- Módulo de hook `useMatchForecast` (exportación por defecto, antes `useRivalStats`) con la misma forma de retorno.
- Módulo de servicio `matchForecastService` con las mismas funciones y tipos exportados que el antiguo `rivalStatsService` (`getRivalStats`, `requestRivalStats`, `getRivalTeamStats`, las funciones de simulación y sus tipos); cada URL de petición usa ya la base `/api/teams/${teamId}/match-forecast` desde el Step 1.
- Tabla de rutas de la app Coach: `match-forecast` y `match-forecast/simulation` envueltas en `RequireFeaturePermission` con la ruta de funcionalidad de Convocatorias; `rival-stats` y `rival-stats/simulation` renderizan `<RedirectKeepingSearch to="/coach/match-forecast" />` y `<RedirectKeepingSearch to="/coach/match-forecast/simulation" />` fuera de la guarda.
- Entrada del menú del equipo: clave `match-forecast`, etiqueta `Pronóstico de partidos`, destino `/coach/match-forecast` con la query `teamId`; `isTeamNavRoute` reconoce `/coach/match-forecast` y `/coach/match-forecast/simulation`.
- `Front/package.json` `version` `1.117.0`.

**Test assertions**:
- `MemoryRouter` en `/coach/rival-stats?teamId=abc` con las rutas de redirección → la ubicación pasa a `/coach/match-forecast` con search `?teamId=abc`. Anclaje: `openspec/changes/match-forecast-rename-coach-only/specs/match-forecast/spec.md` escenario «Ruta antigua de la página».
- `MemoryRouter` en `/coach/rival-stats/simulation?teamId=abc` → la ubicación pasa a `/coach/match-forecast/simulation` con search `?teamId=abc`. Anclaje: `openspec/changes/match-forecast-rename-coach-only/specs/match-forecast/spec.md` escenario «Ruta antigua de la simulación».
- El enlace push antiguo `/coach/rival-stats?teamId=abc` termina en la página de pronóstico del equipo `abc` (misma aserción de redirección). Anclaje: `openspec/changes/match-forecast-rename-coach-only/specs/match-forecast/spec.md` escenario «Enlace de una notificación push ya enviada».
- `teamSections` para un equipo con acceso a la competición → la sección «Competición» contiene una entrada con texto `Pronóstico de partidos` y destino `/coach/match-forecast?teamId=team-1`, y ninguna entrada `Estadísticas de rivales`. Anclaje: `openspec/changes/match-forecast-rename-coach-only/specs/match-forecast/spec.md` escenario «Entrada del menú del equipo».
- `isTeamNavRoute('/coach/match-forecast')` e `isTeamNavRoute('/coach/match-forecast/simulation')` son true. Anclaje: `openspec/changes/match-forecast-rename-coach-only/specs/match-forecast/spec.md` escenario «La barra de navegación del equipo se muestra en la ruta nueva».
- Página renderizada con un informe completado → encabezado `Pronóstico de partidos` presente y sin texto `Estadísticas de rivales`. Anclaje: `openspec/changes/match-forecast-rename-coach-only/specs/match-forecast/spec.md` escenario «Título de la página».
- Con rol Coach, el enlace llamado `Crear pronóstico` tiene `href` `/coach/match-forecast/simulation` conservando la query string. Anclaje: `openspec/changes/match-forecast-rename-coach-only/specs/match-forecast/spec.md` escenario «Botón de la simulación».
- `matchForecastService` (módulo renombrado) mantiene las mismas funciones exportadas y la base URL `/api/teams/${teamId}/match-forecast` fijada en el Step 1; su test movido pasa cambiando solo la ruta de import. Anclaje: `openspec/changes/match-forecast-rename-coach-only/specs/rival-simulation-history/spec.md` requisito «Simulation history with real results».
- La navegación hacia atrás de la página de simulación apunta a `/coach/match-forecast`. Anclaje: `openspec/changes/match-forecast-rename-coach-only/specs/rival-match-simulation/spec.md` requisito «Simulation page».
- Un usuario cuyos permisos no incluyen la funcionalidad de Convocatorias (y que no es `Administrator`) que abre `/coach/rival-stats` es redirigido y el contenido de la página nunca se renderiza (la guarda actúa sobre el destino). Anclaje: `openspec/changes/match-forecast-rename-coach-only/specs/coach-dashboard-permission-ui/spec.md` escenario «Former rival-stats routes keep the permission check».
- Un usuario con rol `Player` que abre `/coach/match-forecast` ve la página renderizarse con normalidad. Anclaje: `openspec/changes/match-forecast-rename-coach-only/specs/coach-dashboard-permission-ui/spec.md` escenario «Player navigates directly to the match forecast routes».

### Tasks

**Files Affected**:
```text
R Front/src/apps/coach/pages/rivalStats/RivalStats.tsx -> Front/src/apps/coach/pages/matchForecast/MatchForecast.tsx
R Front/src/apps/coach/pages/rivalStats/RivalStats.module.css -> Front/src/apps/coach/pages/matchForecast/MatchForecast.module.css
R Front/src/apps/coach/pages/rivalStats/__tests__/RivalStats.test.tsx -> Front/src/apps/coach/pages/matchForecast/__tests__/MatchForecast.test.tsx
R Front/src/apps/coach/pages/rivalStats/__tests__/RivalStats.leagueSummary.test.tsx -> Front/src/apps/coach/pages/matchForecast/__tests__/MatchForecast.leagueSummary.test.tsx
R Front/src/apps/coach/pages/rivalStats/components/RivalTeamCard.tsx -> Front/src/apps/coach/pages/matchForecast/components/RivalTeamCard.tsx
R Front/src/apps/coach/pages/rivalStats/components/RivalTeamCard.module.css -> Front/src/apps/coach/pages/matchForecast/components/RivalTeamCard.module.css
R Front/src/apps/coach/pages/rivalStats/components/RivalPlayerCard.tsx -> Front/src/apps/coach/pages/matchForecast/components/RivalPlayerCard.tsx
R Front/src/apps/coach/pages/rivalStats/components/RivalPlayerCard.module.css -> Front/src/apps/coach/pages/matchForecast/components/RivalPlayerCard.module.css
R Front/src/apps/coach/pages/rivalStats/simulation/RivalSimulation.tsx -> Front/src/apps/coach/pages/matchForecast/simulation/RivalSimulation.tsx
R Front/src/apps/coach/pages/rivalStats/simulation/RivalSimulation.module.css -> Front/src/apps/coach/pages/matchForecast/simulation/RivalSimulation.module.css
R Front/src/apps/coach/pages/rivalStats/simulation/simulationFormat.ts -> Front/src/apps/coach/pages/matchForecast/simulation/simulationFormat.ts
R Front/src/apps/coach/pages/rivalStats/simulation/__tests__/RivalSimulation.test.tsx -> Front/src/apps/coach/pages/matchForecast/simulation/__tests__/RivalSimulation.test.tsx
R Front/src/apps/coach/pages/rivalStats/simulation/components/MatchPredictionCard.tsx -> Front/src/apps/coach/pages/matchForecast/simulation/components/MatchPredictionCard.tsx
R Front/src/apps/coach/pages/rivalStats/simulation/components/MatchPredictionCard.module.css -> Front/src/apps/coach/pages/matchForecast/simulation/components/MatchPredictionCard.module.css
R Front/src/apps/coach/pages/rivalStats/simulation/components/ProjectedStandingCard.tsx -> Front/src/apps/coach/pages/matchForecast/simulation/components/ProjectedStandingCard.tsx
R Front/src/apps/coach/pages/rivalStats/simulation/components/ProjectedStandingCard.module.css -> Front/src/apps/coach/pages/matchForecast/simulation/components/ProjectedStandingCard.module.css
R Front/src/apps/coach/pages/rivalStats/simulation/components/__tests__/MatchPredictionCard.test.tsx -> Front/src/apps/coach/pages/matchForecast/simulation/components/__tests__/MatchPredictionCard.test.tsx
R Front/src/apps/coach/pages/rivalStats/simulation/components/__tests__/ProjectedStandingCard.test.tsx -> Front/src/apps/coach/pages/matchForecast/simulation/components/__tests__/ProjectedStandingCard.test.tsx
R Front/src/apps/coach/hooks/useRivalStats.ts -> Front/src/apps/coach/hooks/useMatchForecast.ts
R Front/src/apps/coach/hooks/__tests__/useRivalStats.test.ts -> Front/src/apps/coach/hooks/__tests__/useMatchForecast.test.ts
R Front/src/apps/coach/services/rivalStatsService.ts -> Front/src/apps/coach/services/matchForecastService.ts
R Front/src/apps/coach/services/__tests__/rivalStatsService.simulation.test.ts -> Front/src/apps/coach/services/__tests__/matchForecastService.simulation.test.ts
M Front/src/apps/coach/hooks/useRivalSimulation.ts
M Front/src/apps/coach/hooks/__tests__/useRivalSimulation.test.ts
M Front/src/apps/coach/routes.tsx
M Front/src/apps/coach/navigation/teamSections.ts
M Front/src/apps/coach/navigation/teamNavRoutes.ts
M Front/src/apps/coach/navigation/__tests__/teamSections.test.ts
M Front/src/apps/coach/navigation/__tests__/teamNavRoutes.test.ts
M Front/package.json
A Front/src/apps/coach/components/RedirectKeepingSearch.tsx
A Front/src/apps/coach/components/__tests__/RedirectKeepingSearch.test.tsx
```
