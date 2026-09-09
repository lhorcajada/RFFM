# implement.md — player-physical-condition-fatigue

> Generado para ejecución por `back-specialist`/`front-specialist`. Sigue las tareas en orden;
> backend (1-4) antes que frontend (5-7), ya que el frontend consume el contrato del endpoint.
> No hagas commit — se revisa y comitea al final.

## Goal

Añadir dos estadísticas persistidas por jugador — Forma física y Cansancio (0-100, modelo
fitness-fatiga clásico de preparación física) — más un indicador derivado, Disponibilidad
(Forma − Cansancio, clamped ≥0). A diferencia de "Rodaje" (derivado, sin estado), estas se
calculan de forma incremental día a día y se persisten, actualizándose de forma perezosa cada
vez que se consulta el endpoint de estadísticas.

Toda la lógica ya está definida en
`openspec/changes/player-physical-condition-fatigue/design.md` — no debería hacer falta
re-derivar decisiones, solo seguir el script.

## Scope & touchpoints

Backend (`Back/ExtractionApi/`):
- `src/RFFM.Api/Domain/Entities/TeamPlayers/TeamPlayerCondition.cs` (NEW)
- `src/RFFM.Api/Infrastructure/Persistence/Configuration/Entities/TeamPlayerConditionEntityConfiguration.cs` (NEW)
- `src/RFFM.Api/Infrastructure/Persistence/AppDbContext.cs` (MODIFY — nuevo `DbSet`)
- Migración EF nueva vía `.\manage-migrations.ps1` (`AddTeamPlayerCondition`)
- `src/RFFM.Api/Features/Coaches/Players/Services/PlayerConditionDayEffect.cs` (NEW)
- `src/RFFM.Api/Features/Coaches/Players/Services/PlayerConditionRecalculationService.cs` (NEW)
- `src/RFFM.Api/Features/Coaches/Players/Queries/GetTeamPlayerStatistics.cs` (MODIFY)
- Tests nuevos en `tests/RFFM.Api.Tests/UnitTests/`

Frontend (`Front/`):
- `src/apps/coach/services/teamPlayerStatisticsService.ts` (MODIFY)
- `src/apps/coach/pages/squad/components/SquadStatistics.tsx` (MODIFY)
- `src/apps/coach/pages/convocations/components/{AlineacionTab,ConvocationTab,SimulacionTab,PartidoEnDirectoTab}.tsx` (MODIFY)
- Componentes de badge/leyenda nuevos o generalizados (ver Decisión 5 de design.md)
- Tests nuevos/ampliados correspondientes

## Conventions

Backend: vertical slice, `IQueryApp`/`ICommand`, `IRequireFeaturePermission`/
`IRequireTeamMembership` donde aplique, migraciones vía `manage-migrations.ps1`, EF configs
descubiertas por reflexión (no registrar a mano). Tests de handlers con Postgres testcontainer
real (`PostgresCollection`), tests de dominio/servicios puros sin DB.

Frontend: CSS Modules, tema Coach oscuro/naranja, único cliente Axios, sin librerías nuevas.

---

## Task 1 — `PlayerConditionDayEffect`

Copia el código de `design.md` → Decisión 2 tal cual en
`Features/Coaches/Players/Services/PlayerConditionDayEffect.cs`. Escribe primero
`PlayerConditionDayEffectTests.cs` con los casos de `tasks.md` §1, confirma que fallan
(la clase no existe), luego implementa.

**Verify**: `dotnet test --filter PlayerConditionDayEffectTests`.

## Task 2 — `TeamPlayerCondition` + migración

1. Test de dominio primero (`TeamPlayerConditionTests.cs`, casos de `tasks.md` §2).
2. Implementa la entidad (código de design.md → Decisión 1).
3. Implementa `TeamPlayerConditionEntityConfiguration.cs` (mismo patrón que
   `TeamPlayerInjuryEntityConfiguration.cs`, `HasIndex(c => c.TeamPlayerId).IsUnique()`).
4. Añade `DbSet<TeamPlayerCondition> TeamPlayerConditions` a `AppDbContext.cs`.
5. Genera la migración: `cd Back/ExtractionApi && .\manage-migrations.ps1` → nombre
   `AddTeamPlayerCondition`. Revisa el archivo de migración generado antes de continuar (debe
   crear la tabla `TeamPlayerConditions` en el esquema `app` con FK a `TeamPlayers`).

**Verify**: `dotnet test --filter TeamPlayerConditionTests`; `dotnet build`.

## Task 3 — `PlayerConditionRecalculationService`

Implementa siguiendo el esqueleto de design.md → Decisión 3. Puntos a resolver tú mismo (el
esqueleto deja `LoadDayEventsAsync` como comentario, no código):

- Query de partidos: `MatchParticipations` del jugador con `MatchPhase == "finished"`, unidas a
  `SportEvents` (mismo `EventId`) para obtener la fecha (`EveDateTime.Date`), agrupadas por
  fecha (si hay más de una participación el mismo día — infrecuente pero posible con
  amistoso+liga — suma minutos de ambas antes de aplicar `MatchDelta`).
- Query de entrenamientos: `Convocations` de `SportEvents` de tipo `"Entrenamiento"` del
  jugador, con fecha del evento. Para cada convocatoria con fecha en rango:
  - Si `ExcuseTypeId == 1` (Lesión, `ExcuseTypes.FromId(1)`) → `DayOutcome.InjuryAbsence`.
  - Si `AssistanceTypeId == AssistanceType.Attendance.Id || AssistanceType.LateArrival.Id` →
    `DayOutcome.Training`.
  - Cualquier otro resultado (ausencia justificada/injustificada, decisión técnica, pendiente)
    → no genera entrada explícita, el día cae en `DayOutcome.Rest` por defecto.
- Combina ambos diccionarios por fecha: si una fecha tiene partido, `DayOutcome.Match` gana
  sobre cualquier entrada de entrenamiento ese mismo día.
- Escribe primero `PlayerConditionRecalculationServiceTests.cs` (casos de `tasks.md` §3, mismo
  patrón de seed que `GetTeamPlayerStatisticsHandlerTests.cs`), confirma Red, luego implementa.

**Verify**: `dotnet test --filter PlayerConditionRecalculationServiceTests`.

## Task 4 — Extender `GetTeamPlayerStatistics`

1. Amplía `GetTeamPlayerStatisticsHandlerTests.cs` (casos de `tasks.md` §4), confirma Red.
2. Añade `PhysicalFitness`, `Fatigue`, `Availability` a `PlayerStatisticsDto`.
3. En el `Handler`, inyecta `PlayerConditionRecalculationService` y llama
   `await conditionService.RecalculateAsync(player.Id, DateTime.UtcNow, cancellationToken)` en
   el bucle `foreach` existente; mapea `condition.PhysicalFitness`/`condition.Fatigue` y calcula
   `Availability = Math.Max(0, condition.PhysicalFitness - condition.Fatigue)`.
4. Registra `PlayerConditionRecalculationService` en DI si no se resuelve automáticamente
   (revisa `DependencyInjection/ServiceCollectionExtensions.cs` — sigue el patrón de registro ya
   usado para servicios similares de esta feature, o constrúyelo con `AppDbContext` inyectado
   directamente si el proyecto no registra explícitamente clases de `Services/` sin interfaz).

**Verify**:
```
cd Back/ExtractionApi
dotnet build
dotnet test
```

## Task 5 — Frontend: servicio y tipos

Amplía `teamPlayerStatisticsService.test.ts` y `teamPlayerStatisticsService.ts` con
`physicalFitness: number`, `fatigue: number`, `availability: number` en `PlayerStatistics`.

**Verify**: `npm run test -- teamPlayerStatisticsService`.

## Task 6 — Frontend: tarjetas de Squad Estadísticas

Añade 3 filas nuevas a la tarjeta de `SquadStatistics.tsx` (Forma física, Cansancio,
Disponibilidad), mismo patrón visual de barra/color que ya usa Rodaje pero como filas
independientes. Test primero confirmando que hoy no aparecen.

**Verify**: `npm run test -- SquadStatistics`; `npm run build`.

## Task 7 — Frontend: convocation tabs

Para cada una de las 4 pestañas, replica el patrón ya construido para Rodaje en esta misma
sesión (badge de banquillo, punto de color en campo, leyenda visible) para Forma
física/Cansancio/Disponibilidad. Investiga primero si conviene generalizar
`ReadinessBadge`/`ReadinessLegend` a un componente parametrizable (`MetricBadge`/`MetricLegend`
con `label`/`thresholds`/`value` como props) en vez de triplicar código — si la generalización
es limpia y no rompe ningún uso existente de Rodaje, hazla; si no, crea componentes hermanos
(`PhysicalConditionBadge`, etc.). Test primero por pestaña confirmando que hoy no aparece.

**Verify**:
```
cd Front
npm run test -- AlineacionTab ConvocationTab SimulacionTab PartidoEnDirectoTab
npm run build
npm run test
```

## Task 8 — Verificación final

```
cd Back/ExtractionApi
dotnet build
dotnet test

cd Front
npm run build
npm run test
```
Ambos en verde (salvo fallos preexistentes ya documentados en `design.md`/sesiones previas). En
el informe final: archivos creados/modificados, cualquier desviación de este script y por qué,
y el resultado exacto de la verificación.
