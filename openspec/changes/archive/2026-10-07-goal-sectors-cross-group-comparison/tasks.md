## 1. Backend: endpoint por equipo (~2h)

- [x] Red: `tests/RFFM.Api.Tests/IntegrationTests/GetGoalSectorsCrossGroupTests.cs` (TestServer +
  Mediator, stubs de `ICalendarService`, `ICompetitionService`, `IActaService`, `SectorFactory` real;
  patrón de `GetCalendarRequiredParamsTests` / `GetActaSeasonTests`):
  - sin `teamCode2` → `400`;
  - sin `competitionId`/`groupId` → `400`;
  - `competitionId2`/`groupId2` distintos → calendario pedido con 100/200 para el equipo 1 y 300/400 para
    el equipo 2; actas con la competición/grupo de cada equipo;
  - sin `competitionId2`/`groupId2` → equipo 2 usa `competitionId`/`groupId`;
  - actas con `RffmOptions.CurrentSeasonId` (22), nunca 21;
  - competiciones de 80' y 90' → `matchTime` 80/90, 6 sectores cada uno, último sector termina en 80/90;
  - goles de un acta del equipo 2 se cuentan en sus sectores.
- [x] Green: `GetGoalSectors.cs` (D1, D2) + `MatchTime` en `GoalSectorsResponse.cs`.
- [x] Subir `<Version>` a `1.17.0` en `Back/ExtractionApi/Directory.Build.props`.
- **Verify**: `dotnet test --filter GetGoalSectorsCrossGroupTests`; `dotnet build`; `dotnet test`.

## 2. Frontend: utilidades de sectores por tramo (~1h)

- [x] Red: `shared/utils/__tests__/goalSectors.test.ts`:
  - misma duración → filas emparejadas por índice, etiqueta `1-15'`;
  - 80' vs 90' → etiqueta `1-14' / 1-15'` y valores de cada equipo en su fila;
  - filas todo-cero se omiten.
- [x] Green: `buildSectorComparisonRows`, `formatSectorLabel`, `matchTime` en `TeamGoalSectors` (D4).
- **Verify**: `npm run test -- goalSectors`.

## 3. Frontend: filtro de dos paneles (~2h)

- [x] `CompetitionSelector` / `GroupSelector`: prop opcional `idPrefix` (sin cambio de comportamiento).
- [x] Red: `pages/Statistics/Components/__tests__/GoalSectorsComparisonFilters.test.tsx` (mocks de
  `services/api`, `useUser`, `useRffmSeason`):
  - ambos paneles («Equipo 1», «Equipo 2») se prellenan con la combinación principal;
  - cambiar la competición de «Equipo 2» limpia su grupo y equipo y no toca «Equipo 1»;
  - cada panel carga sus equipos con su propia competición y grupo.
- [x] Green: `GoalSectorsComparisonFilters.tsx`, `TeamSidePanel.tsx` + CSS Modules (D3).
- [x] Borrar `shared/components/ui/StatsControls/`.
- **Verify**: `npm run test -- GoalSectorsComparisonFilters`.

## 4. Frontend: hook, página, gráfica y tarjetas (~2h)

- [x] Red: `pages/Statistics/hooks/__tests__/useGoalSectorsComparison.test.ts`:
  - `handleCompare` envía `competitionId2`/`groupId2` del equipo 2;
  - el detalle de goles en contra del equipo 2 pide partidos y actas con su competición/grupo.
- [x] Red: `pages/Statistics/__tests__/GoalSectorsComparison.test.tsx`:
  - «Comparar» deshabilitado si falta el equipo de un panel;
  - con resultados 80'/90' se muestra la etiqueta `1-14' / 1-15'`.
- [x] Green: `TeamService.getTeamsGoalSectorsComparison` (+ `competitionId2`, `groupId2`), hook (D5),
  `GoalSectorsComparison.tsx`, `SectorChart` (recibe filas), `SectorDataTable` (`formatSectorLabel`).
- [x] `npm version 1.25.0 --no-git-tag-version` en `Front/`.
- [x] Comprobación visual en desktop y ~375px (validada por el usuario).
- **Verify**: `npm run test`; `npm run build`.

## 5. Cierre

- [x] `openspec validate goal-sectors-cross-group-comparison --strict`.
- [x] Commits (tras confirmación): `feat(mcp-api): compare goal sectors across competitions and groups`,
  `feat(front): reorganize goal sectors filter and compare teams across groups`.
