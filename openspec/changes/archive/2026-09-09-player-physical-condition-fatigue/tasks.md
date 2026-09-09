# Tasks: Forma física + Cansancio del jugador

Cada tarea sigue Red → Green → Refactor. No pasar a la siguiente sin dejar en verde la suite
afectada.

## 1. Backend — `PlayerConditionDayEffect` (algoritmo puro) — ~1.5h

**Red**: `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/PlayerConditionDayEffectTests.cs`
(sin DB). Casos: día de entrenamiento (+3/+5); partido completo 70 min (+2/+10); partido con 35
min (mitad de efecto, +1/+5); partido con 0 min (efecto 0, no negativo); ausencia por lesión
(-4/-6); día de descanso/sin evento (-2/-6); resultado siempre clampable por el llamador (esta
clase no clampa, solo calcula deltas — el clamp vive en `TeamPlayerCondition.Advance`).
Confirmar fallo (clase no existe) antes de implementar.

**Green**: `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Players/Services/PlayerConditionDayEffect.cs`.

**Verificar**: `dotnet test --filter PlayerConditionDayEffectTests`.

## 2. Backend — Entidad `TeamPlayerCondition` + migración — ~1.5h

**Red**: `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/TeamPlayerConditionTests.cs`
(dominio puro, sin DB). Casos: `CreateInitial` fija 30/20 en la fecha dada; `Advance` clampa a
[0,100] por arriba y por abajo; `Advance` actualiza `LastCalculatedDate` a la fecha pasada.

**Green**:
1. `Domain/Entities/TeamPlayers/TeamPlayerCondition.cs`.
2. `Infrastructure/Persistence/Configuration/Entities/TeamPlayerConditionEntityConfiguration.cs`.
3. `DbSet<TeamPlayerCondition> TeamPlayerConditions` en `AppDbContext`.
4. Migración: `cd Back/ExtractionApi && .\manage-migrations.ps1` (nombre `AddTeamPlayerCondition`).

**Verificar**: `dotnet test --filter TeamPlayerConditionTests`; `dotnet build`; migración
generada sin errores (revisar el `.cs` de la migración antes de aplicar).

## 3. Backend — `PlayerConditionRecalculationService` — ~2h

**Red**: `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/PlayerConditionRecalculationServiceTests.cs`
(Postgres testcontainer, mismo patrón `PostgresCollection`/`PostgresContainerFixture` que
`GetTeamPlayerStatisticsHandlerTests.cs`). Casos:
- Jugador sin fila `TeamPlayerCondition` previa y sin ningún evento → tras recalcular a fecha
  `JoinedDate + 5 días`, el resultado refleja 5 días de descanso normal desde 30/20 (clampado si
  aplica).
- Jugador con una fila existente y un entrenamiento nuevo registrado entre el último checkpoint
  y `asOfDate` → el efecto de entreno se aplica ese día concreto, el resto de días del rango
  como descanso.
- Un día con partido Y entrenamiento a la vez → solo se aplica el efecto de partido ese día
  (prioridad confirmada en design.md).
- Un día de ausencia por lesión (`ExcuseTypeId == Injury`) → aplica el efecto de lesión, no el
  de descanso normal.
- Llamar dos veces seguidas con la misma `asOfDate` → la segunda llamada no vuelve a aplicar
  ningún delta (idempotente, `LastCalculatedDate >= asOfDate`).
Confirmar fallo antes de implementar.

**Green**: `Features/Coaches/Players/Services/PlayerConditionRecalculationService.cs`.

**Verificar**: `dotnet test --filter PlayerConditionRecalculationServiceTests`.

## 4. Backend — Extender `GetTeamPlayerStatistics` — ~1h

**Red**: ampliar `GetTeamPlayerStatisticsHandlerTests.cs` con casos: la respuesta incluye
`PhysicalFitness`/`Fatigue`/`Availability`; `Availability` nunca es negativo aunque
`Fatigue > PhysicalFitness`. Confirmar fallo.

**Green**: añadir los 3 campos a `PlayerStatisticsDto`, invocar
`PlayerConditionRecalculationService.RecalculateAsync` por jugador en el handler.

**Verificar**:
```
cd Back/ExtractionApi
dotnet build
dotnet test
```
Suite completa en verde salvo los 2 fallos preexistentes ya conocidos del importador ADN.

## 5. Frontend — Servicio y tipos — ~1h

**Red**: ampliar `teamPlayerStatisticsService.test.ts` con los 3 campos nuevos en la respuesta
esperada.

**Green**: añadir `physicalFitness`, `fatigue`, `availability` a `PlayerStatistics`.

**Verificar**: `npm run test -- teamPlayerStatisticsService`.

## 6. Frontend — Tarjetas de Squad Estadísticas — ~1.5h

**Red**: ampliar los tests de `SquadStatistics` con casos que verifiquen que la tarjeta muestra
Forma física, Cansancio y Disponibilidad.

**Green**: añadir las 3 filas a la tarjeta en `SquadStatistics.tsx`.

**Verificar**: `npm run test -- SquadStatistics`; `npm run build`.

## 7. Frontend — Badges/leyenda en las 4 pestañas de convocatoria — ~2.5h

**Red**: por cada una de las 4 pestañas (Alineación, Convocatoria, Simulador, Partido en
directo), un test que confirme que el nuevo indicador de condición física no aparece hoy.

**Green**: replicar el patrón ya construido para Rodaje (badge en banquillo, punto de color en
campo, leyenda visible) para Forma física/Cansancio/Disponibilidad — decidir si se generaliza
`ReadinessBadge`/`ReadinessLegend` a un componente parametrizable o se crean componentes
hermanos, según lo que resulte más limpio al implementar (ver design.md Decisión 5).

**Verificar**:
```
cd Front
npm run test -- AlineacionTab ConvocationTab SimulacionTab PartidoEnDirectoTab
npm run build
npm run test
```
Suite completa en verde salvo los fallos preexistentes ya documentados en esta sesión
(`TeamRulesEdit.test.tsx`, `PartidoEnDirectoTab.isFriendly.test.tsx`, flakes puntuales de
`SportEventDialog`/`AttendanceSummaryContent`/`Register` bajo carga completa).

## 8. Verificación final — ~30min

```
cd Back/ExtractionApi
dotnet build
dotnet test

cd Front
npm run build
npm run test
```
Confirmar 100% verde en ambos stacks (salvo fallos preexistentes ya documentados) antes de dar
el cambio por terminado.
