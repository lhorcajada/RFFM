## Why

Cada vez que alguien abre Clasificación se lanzan unas 34 peticiones a la RFFM: `GET /calendar`
descarga las 30 jornadas una a una para el popup de resultados de cada equipo, y
`GET /classification` pide las jornadas del grupo y la clasificación. Lo mismo ocurre en las
convocatorias, los sectores de gol y el calendario, el próximo partido y la clasificación de
Mobile. Desde `persist-rffm-results` ya guardamos las jornadas en BD, así que podemos servir el
calendario completo desde ahí y **calcular la clasificación nosotros** con las reglas de la RFFM.
Además, la clasificación estará viva: se actualiza en cuanto termina un partido.

## What Changes

- **Calendario completo desde BD**: la primera consulta de un grupo descarga las jornadas que
  faltan (compartidas entre usuarios) y después se aplica la misma política de refresco que en
  Resultados, a todas las jornadas del grupo.
- **Clasificación calculada** con los partidos guardados: puntos por victoria, empate y derrota de
  la competición; desempates del Reglamento General de la RFFM (art. 46), **validados contra las
  clasificaciones oficiales** de la temporada 2025-2026 jornada a jornada; racha de los últimos
  partidos, datos de local y visitante, y puntos de sanción.
- **La clasificación se guarda en BD**: la vigente, en el grupo; y una foto por jornada
  (histórico). Se recalcula cuando un partido pasa a definitivo.
- **Conciliación con la RFFM**: una única petición a `api/standings` en segundo plano cuando la
  jornada termina entera, para traer lo que no se puede calcular (puntos de sanción, franjas de
  ascenso y descenso) y registrar en el log cualquier diferencia con nuestro cálculo.
- `GET /calendar` y `GET /classification` mantienen su contrato. Los consumidores de un solo
  grupo (convocatorias, sectores de gol y el calendario, el próximo partido y la clasificación de
  Mobile) pasan a leer de BD.
- Frontend: la clasificación se ordena por posición y no solo por puntos (hoy se pierden los
  desempates).

## Non-goals

- Las búsquedas que recorren muchos grupos (`ResolveTeamGroup`, `SearchCompetitionTeams`) siguen
  consultando la RFFM directamente: descargar el calendario de cada grupo sería más caro.
- No hay UI nueva para el histórico de la clasificación.
- No se resuelven empates que requieren un partido de desempate.

## Capabilities

### New Capabilities
- `rffm-standings`: clasificación calculada, persistida y conciliada a partir de los resultados
  guardados.

### Modified Capabilities
- `rffm-results-persistence`: el calendario completo de un grupo se sirve desde BD y el refresco
  se aplica a todas sus jornadas.

## Impact

- Backend (`back-specialist`): dominio en `Domain/Entities/Federation/Results/` (calculadora de
  clasificación y foto por jornada), `Features/Federation/MatchResults/`, `GetCalendar`,
  `GetClassification` y los handlers de Mobile y Teams de un solo grupo; migración.
- Frontend (`front-specialist`): `useClassification.ts` (orden por posición).
