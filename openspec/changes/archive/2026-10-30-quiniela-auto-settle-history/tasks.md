## 1. Backend: servicio de liquidación y apertura (~3h)

- [x] Red: tests de `QuinielaRound.IsComplete` (sin partidos válidos, uno pendiente, todos finales, aplazados ignorados) y de `QuinielaSettlementService`/`OpenNextAsync` (liquida una vez, bote y fondo igual que el manual; `OpenNextAsync` devuelve `null` sin próxima ronda; arrastra carry y % del equipo) en `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/`.
- [x] Green: extraer lógica de `SettleQuiniela` y `OpenQuiniela` a un servicio compartido y dejar los handlers delegando (D1).
- [x] Refactor: los tests existentes `SettleQuinielaHandlerTests` y `OpenQuinielaHandlerTests` siguen en verde sin cambios.
- **Aceptación**: «The jornada is settled automatically» (Matches still pending, Postponed matches do not block), «The next jornada opens automatically».
- **Verify**: `dotnet build` + `dotnet test --filter Quiniela`.

## 2. Backend: concurrencia de la jornada (~2h)

- [x] Red: test de integración (PostgreSQL real) de dos liquidaciones simultáneas de la misma jornada: un solo `TeamFundMovement` y una jornada `Settled`.
- [x] Green: `xmin` como token en `QuinielaEntityConfiguration`, manejo de `DbUpdateConcurrencyException` en el servicio (D3).
- [x] Migración con `.\manage-migrations.ps1`, **en commit aparte**.
- **Aceptación**: «Settled twice».
- **Verify**: `dotnet build` + `dotnet test --filter Quiniela`.

## 3. Backend: worker automático (~3h)

- [x] Red: tests del worker/servicio de ciclo (liquida y abre la siguiente; no toca jornadas con partidos pendientes; un fallo en una jornada no impide procesar las demás; equipo con última jornada liquidada sin sucesora reintenta abrir).
- [x] Green: `QuinielaAutoCloseWorker` + opción `Quiniela:AutoClosePollMinutes` y registro en `ServiceCollectionExtensions` (D2).
- **Aceptación**: «Last match finishes», «One jornada fails», «Next round available», «No next round».
- **Verify**: `dotnet build` + `dotnet test --filter Quiniela`.

## 4. Backend: endpoint de histórico (~3h)

- [x] Red: validator y handler de `GetQuinielaHistory` (orden descendente, paginación por defecto 10 y máx. 50, jornada sin ganadores, jornada abierta excluida, Follower y ajeno → 403, resultado propio) + integración 401/403.
- [x] Green: `Features/Coaches/Quiniela/GetQuinielaHistory.cs`, extraer la construcción de ganadores de `GetCurrentQuiniela` a `QuinielaSupport` (D4), validator registrado en `AddQuinielaValidators`.
- [x] Subir la versión minor de la API en `Back/ExtractionApi/Directory.Build.props` (D6).
- **Aceptación**: «The history lists the settled jornadas» (todos los escenarios).
- **Verify**: `dotnet build` + `dotnet test` (suite completa una sola vez, al terminar el bloque backend).

## 5. Frontend: cierre y resultados en la home (~3h)

- [x] Red: tests de `QuinielaPromoCard` (cerrada con hora de cierre, sin boleto → «No participas», CTA «Ver mi boleto») y de la home (tarjeta de resultados junto a la quiniela nueva abierta; oculta cuando la nueva está cerrada; premio propio destacado; sin ganadores con bote; enlace «Ver histórico»).
- [x] Green: `QuinielaPromoCard.tsx`, `QuinielaWinnersCard.tsx`, helpers de estado en `quinielaHelpers.ts` (D5) + CSS Modules.
- **Aceptación**: «Tickets are locked when the deadline closes», «The home shows the result and the prize distribution».
- **Verify**: `npx vitest run src/apps/coach/pages/team-dashboard src/apps/coach/pages/quiniela`.

## 6. Frontend: pantalla de histórico (~3h)

- [x] Red: tests de `quinielaService` (`getQuinielaHistory`) y de `QuinielaHistory` (tarjeta actual en sus 4 estados, lista de jornadas con ganadores, propios destacados, «Cargar más», vacío, error con reintentar, acceso del entrenador a «Abrir quiniela»).
- [x] Red: test de `Quiniela.tsx` (enlace «Histórico»; sin acciones de edición con `picksClosed`).
- [x] Green: `QuinielaHistory.tsx` + CSS Module, ruta lazy `quiniela/historico`, servicio y enlaces desde `Quiniela.tsx` y la tarjeta de resultados (D5).
- [x] Red: tests de `teamSections` (entrada «Histórico de quinielas» para jugador y entrenador, ausente sin acceso) y del enlace «Ver resultados anteriores» en la tarjeta (visible con `previous`, oculto sin él, también tras ocultarse la tarjeta de resultados).
- [x] Green: entrada de menú y enlace permanente (D5).
- [x] Subir la versión minor de la web con `npm version <x.y.z> --no-git-tag-version` en `Front/` (D6).
- **Aceptación**: «The history screen leads to the current quiniela» y «The history is always reachable» (todos los escenarios).
- **Verify**: `npx vitest run src/apps/coach/pages/quiniela`.

## 7. Verificación final (~1h)

- [x] `npm run build` (OK) y `npx vitest run --maxWorkers=2` en `Front/` (una sola vez).
- [x] Comprobación visual a 360 px de la home (cerrada y con resultados) y del histórico.
- [x] `openspec validate quiniela-auto-settle-history --strict`.
