# Tasks: Pestaña de Estadísticas de plantilla + Estado de forma

Cada tarea sigue Red → Green → Refactor. No pasar a la siguiente tarea sin dejar en verde la
suite afectada.

## 1. Backend — `PlayerFormStatusCalculator` (algoritmo puro) — ~2h

**Red**
- Crear `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/PlayerFormStatusCalculatorTests.cs`
  (sin `PostgresCollection` — es un cálculo puro, no toca DB).
- Casos a cubrir (Theory + Fact, siguiendo `testing.md` §3.3/3.4):
  - Todas las sesiones "Asiste" (16 entrenamientos) + 8 partidos de `ExpectedMinutesPerMatch`
    minutos → `FormStatus == 100`.
  - Sin ningún entrenamiento con resultado y sin minutos de partido → `FormStatus == null`.
  - Una ausencia por lesión vs. una ausencia por estudios con el resto de sesiones iguales →
    el caso lesión da un `FormStatus` estrictamente menor.
  - Ausencia con `ExcuseTypeId = TechnicalDecision` no reduce `SessionsConsidered` ni
    `TrainingComponent` frente al mismo caso sin esa sesión.
  - Convocatoria `Deconvoke` sin `AssistanceTypeId` se excluye del cálculo (no cuenta como
    ausencia).
  - Minutos de partido por encima de `BaselineMatches * ExpectedMinutesPerMatch` no hacen
    superar 100 en `MatchComponent`.
  - `RecentAbsences` devuelve como máximo 10 entradas, ordenadas por fecha descendente, y
    excluye las sesiones con 100 puntos (asistencias).
- Ejecutar `dotnet test --filter PlayerFormStatusCalculatorTests` y confirmar que falla
  (la clase aún no existe).

**Green**
- Implementar `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Players/Services/
  PlayerFormStatusCalculator.cs` según `design.md` Decisión 2.

**Verificar**
```
cd Back/ExtractionApi
dotnet build
dotnet test --filter PlayerFormStatusCalculatorTests
```

## 2. Backend — Endpoint `GetTeamPlayerStatistics` — ~2h

**Red**
- Crear `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/GetTeamPlayerStatisticsHandlerTests.cs`,
  mismo patrón de seed que `GetPlayerSeasonCardsHandlerTests.cs`
  (`PostgresCollection`, `SeedTeamAsync`/`SeedTeamPlayerAsync` reutilizados o adaptados).
- Casos:
  - Jugador con partidos/entrenamientos fuera de la ventana de 8 semanas → esos eventos no
    afectan a `FormStatus` pero sí a `Goals`/`YellowCards`/`RedCards`/`MinutesPlayed`
    (histórico completo de temporada).
  - Jugador con goles/tarjetas en `GoalsJson`/`CardsJson` → `Goals`/`YellowCards`/`RedCards`
    coinciden con `PlayerCardCountService`/el conteo de goles ya usado en
    `GetSeasonPlayerStats`.
  - Jugador sin ninguna convocatoria ni participación → `FormStatus == null`,
    `Goals/Cards/Minutes == 0`.
  - Endpoint requiere pertenencia al equipo (`IRequireTeamMembership`) y permiso
    `CoachFeatureRoutes.Squad`/`Read` (`IRequireFeaturePermission`).
- Confirmar fallo (`dotnet test --filter GetTeamPlayerStatisticsHandlerTests`).

**Green**
- Implementar `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Players/Queries/
  GetTeamPlayerStatistics.cs` (endpoint + query + handler) según `design.md` Decisión 1 y 3.

**Verificar**
```
cd Back/ExtractionApi
dotnet build
dotnet test --filter GetTeamPlayerStatisticsHandlerTests
```

## 3. Frontend — Servicio `teamPlayerStatisticsService.ts` — ~1h

**Red**
- Crear `Front/src/apps/coach/services/__tests__/teamPlayerStatisticsService.test.ts`
  (`vi.mock` sobre `core/api/client.ts`, mismo patrón que otros `*Service.test.ts` de la
  carpeta).
- Casos: llama a `GET /catalog/team/{teamId}/player-stats`, mapea la respuesta 1:1 al tipo
  `PlayerStatistics`, propaga el error si la petición falla.
- Confirmar fallo (`npm run test -- teamPlayerStatisticsService`).

**Green**
- Implementar `Front/src/apps/coach/services/teamPlayerStatisticsService.ts` (tipos
  `PlayerStatistics`, `FormStatusBreakdown`, `RecentAbsence` + función
  `getTeamPlayerStatistics`).

**Verificar**
```
cd Front
npm run test -- teamPlayerStatisticsService
```

## 4. Frontend — Componente `SquadStatistics.tsx` (tabla + orden + filtro) — ~2h

**Red**
- Crear `Front/src/apps/coach/pages/squad/components/__tests__/
  SquadStatistics.sortAndFilter.test.tsx`.
- Casos (Testing Library, `getByRole`/`getByText`, ver `frontend-testing.md` §2.3):
  - Renderiza una fila por jugador con dorsal/goles/amarillas/rojas/minutos/estado de forma.
  - Clic en la cabecera "Goles" reordena las filas de mayor a menor; segundo clic invierte el
    orden.
  - Seleccionar una posición en el filtro oculta las filas de otras posiciones.
  - `FormStatus == null` renderiza "Sin datos" en vez de una barra al 0%.
- Confirmar fallo.

**Red (tooltip)**
- Añadir `SquadStatistics.tooltip.test.tsx`: al hacer hover/focus sobre la celda de estado de
  forma de un jugador con `RecentAbsences`, se muestra el motivo y el impacto de al menos una
  ausencia reciente.
- Confirmar fallo.

**Green**
- Implementar `Front/src/apps/coach/pages/squad/components/SquadStatistics.tsx` +
  `SquadStatistics.module.css` según `design.md` Decisión 4.

**Verificar**
```
cd Front
npm run test -- SquadStatistics
```

## 5. Frontend — Exportación PDF `squadStatsPdfExport.ts` — ~1h

**Red**
- Crear `Front/src/apps/coach/pages/squad/__tests__/squadStatsPdfExport.test.ts`.
- Casos: `exportSquadStatisticsPdf` invoca `jsPDF` y llama a `doc.save(...)` con un nombre de
  archivo que incluye el nombre del equipo saneado (mismo patrón `safeFilename` que
  `squadPdfExport.ts`); no lanza si `teamName` es `undefined`.
- Confirmar fallo.

**Green**
- Implementar `Front/src/apps/coach/pages/squad/squadStatsPdfExport.ts`.

**Verificar**
```
cd Front
npm run test -- squadStatsPdfExport
```

## 6. Frontend — Integrar la pestaña en `Squad.tsx` — ~1h

**Red**
- Extender `Front/src/apps/coach/pages/trainings/__tests__/` → no aplica; crear/ampliar
  `Front/src/apps/coach/pages/squad/__tests__/Squad.statisticsTab.test.tsx`.
- Casos: la pestaña "Estadísticas" aparece para roles admin/coach; no aparece para `isFan`;
  al seleccionarla, se invoca `getTeamPlayerStatistics(team.id)` y se renderiza
  `SquadStatistics`.
- Confirmar fallo.

**Green**
- Modificar `Front/src/apps/coach/pages/squad/Squad.tsx`: nuevo `<Tab label="Estadísticas" />`
  + estado/carga + render condicional (`activeTab === 4`), siguiendo el patrón ya usado por
  los tabs 1-3 de este mismo archivo.

**Verificar**
```
cd Front
npm run test -- Squad.statisticsTab
npm run build
```

## 7. Verificación final de la suite completa — ~30min

```
cd Back/ExtractionApi
dotnet build
dotnet test

cd Front
npm run build
npm run test
```

- Confirmar 100% de tests en verde en ambos stacks antes de dar el cambio por terminado.
- Revisar cobertura: `PlayerFormStatusCalculator` ≥85% (lógica de dominio/algoritmo),
  handler ≥80%, `SquadStatistics.tsx` ≥75%.
