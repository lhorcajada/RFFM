## 1. Backend — Día cerrado en `DailyLoadModel` (~1h)

- [x] Red: tests en `PlayerFormStatusCalculatorTests`/`PlayerReadinessCalculatorTests` (o `DailyLoadModelTests`). Con `todayIsClosed = true`, un día sin actividad cuenta como descanso: aplica gracia y decaimiento. Con el valor por defecto `false`, el resultado no cambia (los tests actuales siguen en verde).
- [x] Green: parámetro opcional `todayIsClosed` en `Simulate`/`Evaluate` y en los dos calculadores (design.md D3).
- **Verify**: `dotnet test --filter "DailyLoad|FormStatusCalculator|ReadinessCalculator"`.

## 2. Backend — `PlayerLoadInputsBuilder` + refactor (~2h)

- [x] Red: `PlayerLoadInputsBuilderTests`:
  - entrenos → `TrainingInput` con outcome y motivo;
  - partidos filtrados por `JoinedDate`/`LeftDate`, salvo que el jugador tenga minutos;
  - motivos «No convocado» / «Convocado sin jugar» / excusa;
  - eventos de Cansancio con `DaysAgo` relativo a `asOf` y sin eventos posteriores a `asOf`.
- [x] Green: `Services/PlayerLoadInputsBuilder.cs` (design.md D4).
- [x] Refactor: `GetTeamPlayerStatistics` usa el helper. `GetTeamPlayerStatisticsHandlerTests` debe quedar en verde **sin tocar los tests**.
- **Verify**: `dotnet build` + `dotnet test --filter "PlayerLoadInputsBuilder|GetTeamPlayerStatistics"`.

## 3. Backend — Serie diaria (~2h)

- [x] Red: `PlayerPhysicalEvolutionCalculatorTests`:
  - `days` puntos, del más antiguo a hoy;
  - un entreno de hace 5 días solo afecta desde su día;
  - el último punto == `PlayerFormStatusCalculator`/`PlayerReadinessCalculator`/`PlayerFatigueCalculator` con los parámetros de hoy;
  - sin actividad → `null`/`null`/`0`;
  - `categoryHalfMinutes = null` → `FormStatus` siempre `null`;
  - días pasados cerrados como descanso.
- [x] Green: `Services/PlayerPhysicalEvolutionCalculator.cs` (design.md D5).
- **Verify**: `dotnet test --filter PlayerPhysicalEvolutionCalculator`.

## 4. Backend — Endpoint (~2h)

- [x] Red: `GetPlayerPhysicalEvolutionHandlerTests` (Postgres, mismo seeding que `GetTeamPlayerStatisticsHandlerTests`):
  - 28 puntos por defecto y 56 con `days=56`;
  - **el último punto coincide con la fila del jugador en `GetTeamPlayerStatistics`**;
  - `events` solo con entrenos asistidos y partidos con minutos dentro del rango;
  - lesión activa con `endDate = null`;
  - categoría sin duración estándar → `formStatusAvailable = false`;
  - jugador de otro equipo → not found;
  - validator: `days = 30` → error de validación.
- [x] Green: `Queries/GetPlayerPhysicalEvolution.cs` (endpoint + Query + Validator + Handler + DTOs, design.md D6).
- **Verify**: `dotnet build` + `dotnet test`.

## 5. Frontend — Dependencia, servicio y hook (~1,5h)

- [x] `npm install @mui/x-charts@^7.29.1` (comprobar que no hay conflictos de peer deps).
- [x] Red: tests del servicio (`getPlayerPhysicalEvolution` llama a la URL con `days`) y de `usePlayerPhysicalEvolution` (carga, error, cambio de `days` → nueva petición, `retry`).
- [x] Green: tipos + función en `teamPlayerStatisticsService.ts`; hook en `pages/player/hooks/` (design.md D7).
- **Verify**: `npm run test -- teamPlayerStatisticsService usePlayerPhysicalEvolution`.

## 6. Frontend — Componente en la ficha (~2,5h)

- [x] Red: `PlayerPhysicalEvolution.test.tsx`, con `@mui/x-charts/LineChart` mockeado:
  - tres series y resumen «Forma 62 (+8)»;
  - sin serie ni resumen de Forma si `formStatusAvailable = false`;
  - «8 semanas» → `days=56`;
  - el día seleccionado muestra valores y eventos («Entreno · Físico», «Partido · 60'»);
  - estados de carga, error con «Reintentar» y vacío.

  `PlayerDetail.statsTab.test.tsx` renderiza la sección en la pestaña Estadísticas.
- [x] Green: `pages/player/components/PlayerPhysicalEvolution.tsx` + `.module.css` y uso en `PlayerDetail.tsx`.
- [x] Colores de serie con los tokens del tema Coach aprobados (design.md → Open Questions).
- [x] Revisión visual a ~375 px y en escritorio con el tema Coach (validada por el usuario).
- **Verify**: `npm run test` + `npm run build` (revisar el tamaño del chunk de `PlayerDetail`).

## 7. Frontend — Enlace desde la plantilla (~0,5h)

- [x] Comprobar que `/coach/player/:id` recibe el `teamPlayerId`.
- [x] Red: `SquadStatistics.evolutionLink.test.tsx`: «Ver evolución» llama a `onOpenPlayer(teamPlayerId)`; sin la prop no se muestra.
- [x] Green: botón en `SquadStatistics.tsx` + `Squad.tsx` navega a `/coach/player/{teamPlayerId}`.
- **Verify**: `npm run test -- SquadStatistics`.

## 8. Validación

- [x] `openspec validate player-physical-evolution --strict`.
- [x] Suites completas de back y front en verde.
- [x] Preguntar al usuario antes de commitear.
