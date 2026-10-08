## 1. Backend: alineación inicial en el guardado del directo (~1.5h)

- [x] Red: `tests/RFFM.Api.Tests/UnitTests/SaveMatchParticipationStartingLineupTests.cs`:
  - guardar con `startingLineupJson` → se persiste en las filas del evento;
  - re-guardar sin `startingLineupJson` → se conserva el valor anterior.
- [x] Green: `MatchParticipation.StartingLineupJson` (`Create`/`Update`), configuración EF,
  `SaveMatchParticipationRequest.StartingLineupJson` (D4).
- [x] Migración `AddStartingLineupToMatchParticipation` (`.\manage-migrations.ps1`) — commit separado.
- **Verify**: `dotnet test --filter SaveMatchParticipationStartingLineupTests`; `dotnet build`.

## 2. Backend: índice de disponibilidad (~1.5h)

- [x] Red: `tests/RFFM.Api.Tests/IntegrationTests/GetTeamMatchReportsTests.cs`:
  - liga con acta, marcador y directo `finished` → ambos flags;
  - liga con acta sin directo → solo federación;
  - amistoso con directo `finished` → solo directo;
  - amistoso sin directo → no aparece;
  - directo no `finished` → `hasLiveReport` false;
  - liga sin marcador → no aparece;
  - FamilyMember de otro equipo → `403`.
- [x] Green: `Features/Coaches/MatchReports/MatchReportRules.cs` + `GetTeamMatchReports.cs` (D1).
- **Verify**: `dotnet test --filter GetTeamMatchReportsTests`.

## 3. Backend: informe del directo (~2h)

- [x] Red: `tests/RFFM.Api.Tests/UnitTests/LiveMatchReportBuilderTests.cs`:
  - goles 52/10/31 → 10/31/52 con marcador parcial;
  - tarjetas ordenadas, rival con dorsal;
  - ventanas: descanso + 4 ventanas en orden, nombres de entra/sale resueltos;
  - JSON nulo o corrupto → listas vacías.
- [x] Red: `tests/RFFM.Api.Tests/IntegrationTests/GetMatchReportTests.cs`:
  - titulares con `slotIndex` desde `StartingLineupJson`;
  - fallback a `TeamIdealLineup` (`SeasonId == eventId`) sin `StartingLineupJson`;
  - convocado que no jugó → banquillo con 0';
  - evento sin directo → `live` null y flags correctos;
  - evento inexistente → `404`; Player del equipo → `200`.
- [x] Green: `LiveMatchReportBuilder.cs` + `GetMatchReport.cs` (D2).
- **Verify**: `dotnet test --filter "LiveMatchReportBuilderTests|GetMatchReportTests"`.

## 4. Backend: acta de federación por evento (~1h)

- [x] Red: `tests/RFFM.Api.Tests/IntegrationTests/GetEventFederationActaTests.cs` (stub de
  `IActaService`, patrón `GetActaSeasonTests`):
  - liga → acta pedida con `codActa`, competición/grupo del equipo y `CurrentSeasonId`;
  - amistoso → `404`; servicio devuelve null → `404`.
- [x] Green: `GetEventFederationActa.cs` (D3).
- [x] `GetTeamCalendar` (mobile): `CodActa` en `MobileMatchDto` + test en el existente.
- [x] `<Version>` → `1.20.0` en `Back/ExtractionApi/Directory.Build.props`.
- **Verify**: `dotnet build`; `dotnet test`.

## 5. Front: mover componentes de acta a shared (~1.5h)

- [x] Mover `apps/federation/components/acta/*` → `shared/components/acta/*` y
  `apps/federation/types/acta.ts` → `shared/types/acta.ts`; actualizar imports.
- [x] Red: `shared/components/acta/ActaContent/__tests__/ActaContent.test.tsx` (renderiza equipos,
  goles y cambios de un acta de ejemplo).
- [x] Green: extraer `ActaContent` y usarlo en `federation/pages/Acta/Acta.tsx`.
- **Verify**: `npm run test`; `npm run build`; revisión visual del acta de Federación.

## 6. Front: guardado de la alineación inicial (~1h)

- [x] Red: `pages/convocations/hooks/__tests__/useLiveMatch.startingLineup.test.tsx` → el payload de
  guardado incluye `startingLineupJson` con esquema y huecos iniciales.
- [x] Green: `useLiveMatch` (`getStartingFormation`), `PartidoEnDirectoTab`, tipos (D4).
- **Verify**: `npm run test -- useLiveMatch`.

## 7. Front: página «Acta del partido» (~2h)

- [x] Red: `pages/matchReport/__tests__/MatchReport.tabs.test.tsx`:
  - ambos flags → dos pestañas, «Federación» seleccionada;
  - solo directo → sin pestaña «Federación»;
  - error del acta RFFM → mensaje en español y la pestaña de directo funciona.
- [x] Red: `pages/matchReport/components/__tests__/LiveReportTab.test.tsx`:
  - goles en orden con «10'» y «31'»; banquillo con 0'; ventanas «Descanso», «Ventana 1»…;
    titulares en el campo con sus minutos.
- [x] Green: `matchReportService.ts`, `MatchReport.tsx`, `FederationActaTab`, `LiveReportTab` y
  subcomponentes + CSS Modules, ruta lazy en `routes.tsx` (D6).
- **Verify**: `npm run test -- matchReport`.

## 8. Front: botón «Ver acta» (~1.5h)

- [x] Red: `pages/convocations/components/__tests__/MatchCard.viewReport.test.tsx` y
  `AgendaList.viewReport.test.tsx` (con/sin disponibilidad; el click no navega a la ficha).
- [x] Red: `pages/results/__tests__/Results.viewReport.test.tsx` → solo el partido propio lo muestra.
- [x] Green: `useTeamMatchReports`, `MatchCard`, `AgendaList`, `Convocations`, `RoundPanel`
  (`renderMatchAction`), `Results` (D6).
- [x] `npm version 1.29.0 --no-git-tag-version` en `Front/`.
- [x] Revisión visual a ~375px y escritorio, tema coach (validada por el usuario).
- **Verify**: `npm run test`; `npm run build`.

## 9. Mobile: pantalla y botón (~2h)

- [ ] Leer `Mobile/AGENTS.md` y la doc versionada de Expo antes de tocar navegación.
- [ ] Red: `screens/__tests__/MatchReportScreen.test.tsx` (loading → datos; error con `detail` y
  fallback; pestañas según flags; goles en orden).
- [ ] Red: `screens/components/__tests__/EventCard.viewReport.test.tsx`;
  `screens/__tests__/LeagueScreen.viewReport.test.tsx`.
- [ ] Green: `api/matchReports.ts`, `utils/formationPositions.ts`, `MatchReportScreen`,
  `screens/components/matchReport/*`, `EventCard`, `Calendar/Friendlies/Tournaments/LeagueScreen`,
  registro `MatchReport` en `CalendarStack` y `CompetitionStack` (D7).
- [ ] `version` → `1.2.0` en `Mobile/app.json` y `Mobile/package.json`.
- **Verify**: `cd Mobile && npm test`.
- **Estado**: implementado pero NO integrado; guardado en `git stash` («match-report mobile (tests pendientes)») con 6 tests en rojo por revisar. Se retomará en un cambio aparte.

## 10. Cierre

- [x] `openspec validate match-report --strict`.
- [x] Commits (confirmados por el usuario): `feat(mcp-api): add match report endpoints`,
  `chore(mcp-api): add AddStartingLineupToMatchParticipation migration`, `feat(front): add match report screen`.
  Mobile queda fuera (stash).
