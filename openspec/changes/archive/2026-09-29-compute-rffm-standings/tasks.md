## 1. Calculadora de clasificación (backend, dominio, TDD)

- [x] 1.1 Red: `UnitTests/RffmStandingsCalculatorTests.cs` — estadísticas generales, de local y
      de visitante; puntos con 3/1/0 y con otro sistema; sanción; partido sin goles no cuenta;
      partido con goles y acta abierta cuenta; `upToRound`; racha de los 5 últimos por jornada;
      empate entre dos con los dos partidos jugados (gana el enfrentamiento directo); empate entre
      dos con solo la ida (gana la DG general); triple empate con mini-liga completa; triple
      empate eliminatorio (la mini-liga incompleta → DG, y los dos restantes vuelven al
      enfrentamiento directo); desempate final por nombre; una sola vuelta (DG → GF → directo);
      equipo sin partidos jugados.
- [x] 1.2 Green: `RffmStandingsCalculator` y sus records.
- [x] 1.3 Test de regresión con datos reales: un grupo completo de la temporada 21 (resultados y
      clasificación oficial en fixtures JSON) → el orden calculado coincide con el oficial en las
      30 jornadas (`RffmStandingsCalculatorRealDataTests`, grupo 24037744).

## 2. Modelo y persistencia

- [x] 2.1 Red/Green: `RffmCompetitionGroup` (puntos, `UpdateStandings(json, round, now)`,
      `UpdateOfficialStandings(json, round)`), `RffmStandingsSnapshot` y `StandingsSource`.
- [x] 2.2 Configuraciones EF y `DbSet`; migración `AddRffmStandings` — **commit separado**.

## 3. Sincronización del grupo completo y recálculo (backend, TDD, Postgres)

- [x] 3.1 Red: `IntegrationTests/RffmGroupStandingsTests.cs` — `GetCalendarAsync` de un grupo nuevo descarga
      todas las jornadas (1 `results` por jornada) y la segunda consulta no llama a la RFFM;
      solo se refrescan las jornadas que lo necesitan; un fallo en una jornada no impide
      devolver el resto; la competición se busca en otra temporada si no está en la pedida;
      `GetClassificationAsync` devuelve la clasificación calculada y guarda las fotos por
      jornada; un resultado nuevo recalcula la clasificación; con jornadas pasadas sin
      sincronizar se devuelve la oficial; jornada con todas las actas cerradas → conciliación
      encolada.
- [x] 3.2 Green: `FindCompetitionAsync`, sincronización del grupo completo (`SyncAsync`, con
      peticiones de jornadas en paralelo, como mucho 4), `RecomputeStandingsAsync`,
      `RffmStandingsMapper` (`StandingRow` → `TeamResponse`), `GetCalendarAsync` y
      `GetClassificationAsync`.

## 4. Conciliación (backend, TDD)

- [x] 4.1 Red/Green: `RffmResultsWorkerTests` — la conciliación guarda la clasificación oficial;
      con las mismas estadísticas y distinto orden, la foto pasa a `Official`; una sanción
      nueva recalcula la clasificación. (El caso de estadísticas distintas solo registra un
      warning y no tiene test propio.)

## 5. Endpoints y consumidores (backend, TDD)

- [x] 5.1 Red/Green: `GET /classification` (IRequest) usa el servicio (test de endpoint);
      `GetTeamClassification` (Mobile) usa el servicio; `CalendarService.GetCalendarAsync`
      delega en el servicio; `dotnet build` y `dotnet test` en verde.

## 6. Frontend (TDD)

- [x] 6.1 Red/Green: `useClassification` ordena por posición (test en
      `shared/hooks/__tests__/useClassification.test.ts`).
- [x] 6.2 `npm run test` (2051 en verde; 3 omitidos que ya existían) y `npm run build` en verde.

## 7. Verificación

- [x] 7.1 Validación final con el script sobre los grupos descargados: 214/220 (97,3 %) en
      11 grupos completos (ver design).
- [x] 7.2 Prueba contra la RFFM real a nivel de servicio: un grupo de la temporada actual →
      calendario completo, clasificación calculada igual a la oficial, y la segunda consulta
      sin peticiones.
      _29/09: grupo 26738048 (Superliga Cadete). 30 jornadas y 240 partidos; clasificación
      calculada idéntica a la oficial en los 16 equipos (puntos, goles, local/visitante y racha);
      primera consulta en 1,8 s y las siguientes en ~10 ms._
- [x] 7.3 `openspec validate compute-rffm-standings --strict`.
