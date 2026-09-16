## 1. Backend — dominio y query (≈2h)

- [x] 1.1 `Domain/Aggregates/Assistances/ExcusesType.cs`: `TechnicalDecision` de `private` a `public`.
- [x] 1.2 Nuevo `Domain/Entities/Competitions/MatchDurationMinutesByCategory.cs` (Juveniles 45,
      Cadetes 40, Infantiles 35, Alevines 30).
- [x] 1.3 Tests unitarios para `MatchDurationMinutesByCategory.TryGetMinutes` (4 categorías F11 +
      una no-F11 → `false`).
- Verificación: `dotnet build`.

## 2. Backend — `GetTeamPlayerStatistics` (≈2h)

- [x] 2.1 Cargar `Team.CategoryId` y resolver `standardMinutes` (o `null` si no es F11).
- [x] 2.2 Calcular `SeasonTotalPossibleMinutes` (partidos/amistosos/torneos finalizados,
      `min(standardMinutes, MAX(MinutesPlayed) por partido)`).
- [x] 2.3 Cargar convocatorias de eventos tipo partido y calcular
      `MatchesAbsentAttributableToPlayer` + `AttributableAbsentMinutes` por jugador (excluye
      `ExcuseTypes.TechnicalDecision`, excluye "nunca convocado").
- [x] 2.4 Calcular `MinutesPlayedPercentOfSeasonTotal` y
      `AttributableAbsentMinutesPercentOfSeasonTotal` (null si no F11).
- [x] 2.5 Añadir los 3 campos nuevos a `PlayerStatisticsDto` (al final, posicional).
- Verificación: `dotnet build`.

## 3. Backend — tests xUnit (≈2h)

- [x] 3.1 Casos: equipo F11 con partido oficial + amistoso más corto (duración capada); jugador
      nunca convocado (excluido); jugador desconvocado por decisión técnica (excluido); jugador
      desconvocado por lesión (incluido); jugador convocado que no se presentó (incluido); equipo
      no-F11 (los 2 campos de porcentaje son `null`, `MatchesAbsentAttributableToPlayer` sigue
      calculándose).
- Verificación: `dotnet test --filter GetTeamPlayerStatistics`.

## 4. Frontend — servicio y tipos (≈1h)

- [x] 4.1 `teamPlayerStatisticsService.ts`: añadir los 3 campos nuevos al tipo `PlayerStatistics` +
      constante `SEASON_MINUTES_TARGET_PERCENT = 30`.
- Verificación: `npm run build` (tipos).

## 5. Frontend — `SquadStatistics.tsx` (≈2h)

- [x] 5.1 Sort por defecto `"ef"`.
- [x] 5.2 Nuevo stat "Ausencias" en la tarjeta.
- [x] 5.3 Nuevo bloque de progreso de minutos (oculto si `minutesPlayedPercentOfSeasonTotal == null`).
- [x] 5.4 Tests Vitest (Red → Green): default sort, stat de ausencias, bloque de minutos visible/
      oculto.
- Verificación: `npm run test -- SquadStatistics`.

## 6. Frontend — CSS móvil (≈1h)

- [x] 6.1 `.sortControl` con scroll horizontal contenido en `≤600px`.
- [x] 6.2 `.positionFilter` con `min-width: 120px` en `≤600px`.
- [x] 6.3 Verificación visual manual en viewport 375px (Chrome DevTools) — sin overflow de página,
      selector de posición legible. (Verificado por revisión de las reglas CSS resultantes, sin
      DevTools disponible en este entorno.)

## 7. Frontend — export PDF (≈1h)

- [x] 7.1 `squadStatsPdfExport.ts`: orientación landscape, columnas "Forma"/"Cansancio", recalcular
      anchos de columna.
- [x] 7.2 Test Vitest (Red → Green) en `squadStatsPdfExport.test.ts`.
- Verificación: `npm run test -- squadStatsPdfExport`.

## 8. Cierre

- [x] 8.1 `dotnet build && dotnet test` (backend completo del feature afectado). 1247/1247 tests OK.
- [x] 8.2 `npm run build && npm run test` (frontend completo). Build OK; 1570/1580 tests OK (7 fallos
      son timeouts preexistentes ajenos a este cambio: Sanctions, TeamRulesEdit, SportEventDialog x5,
      GameModelFormEditor).
- [ ] 8.3 Confirmar con el usuario antes de `git commit`/`git push` (regla `.claude/rules/git.md` §6.3).
