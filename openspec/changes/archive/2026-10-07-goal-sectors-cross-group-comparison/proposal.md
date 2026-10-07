## Why

La página de Federación «Comparativa: Goles por sectores de tiempo» (`/federation/goal-sectors-comparison`)
tiene dos problemas:

1. **Filtro mal organizado en desktop**: `StatsControls` reparte Temporada, Competición, Grupo, Equipo 1 y
   Equipo 2 en un `Grid` de 4 columnas, de modo que «Equipo 2» cae sola en una segunda fila y no queda
   claro qué pertenece a cada equipo. Además su CSS Module inyecta estilos `:global(.MuiOutlinedInput-*)`
   que afectan a toda la app.
2. **Solo se pueden comparar equipos del mismo grupo**: hay una única competición y un único grupo para
   ambos equipos, tanto en el filtro como en el endpoint `GET /teams/{teamCode}/goal-sectors`. Interesa
   comparar, por ejemplo, el equipo propio con el de otro grupo o de otra categoría.

## What Changes

- **Backend (`Back/ExtractionApi`)** — `GetGoalSectors.cs`:
  - Nuevos query params opcionales `competitionId2` / `groupId2` para el equipo 2; si se omiten, se usan
    `competitionId` / `groupId` (compatibilidad con el front actual).
  - `competitionId`, `groupId`, `teamCode1`, `teamCode2` pasan a ser **obligatorios** (hoy tienen ids RFFM
    literales por defecto) → `400` si faltan.
  - Cada equipo usa su propio calendario y la duración de partido (`MatchTime`) de **su** competición; la
    respuesta incluye `matchTime` por equipo. Siempre 6 sectores (3 por parte) ordenados.
  - Las actas se piden con `RffmOptions.CurrentSeasonId` en vez del literal `21`.
  - **Versión**: API minor.
- **Frontend (`Front`)**:
  - Nuevo filtro de página: Temporada arriba y debajo dos tarjetas lado a lado («Equipo 1» / «Equipo 2»),
    cada una con Competición, Grupo y Equipo propios; en móvil se apilan. Ambas tarjetas se prellenan con
    la combinación principal del usuario.
  - Comparación **por tramo** (1º…6º sector): las filas se emparejan por posición; si los rangos de
    minutos difieren (p. ej. 80' vs 90') la etiqueta muestra ambos (`1-14' / 1-15'`).
  - El popup de goles en contra usa la competición, grupo y duración de cada equipo.
  - Se elimina `StatsControls` (único consumidor) y su CSS global.
  - **Versión**: Web minor.

## Capabilities

### New Capabilities
- `goal-sectors-comparison`: comparativa de goles por sectores entre dos equipos de cualquier competición
  y grupo de la temporada RFFM.

## Impact

- `Back/ExtractionApi`: `Features/Federation/Teams/Queries/GetGoalSectors.cs`,
  `Queries/Responses/GoalSectorsResponse.cs`, tests.
- `Front`: `pages/Statistics/` (página, hook, nuevo componente de filtro), `SectorChart`,
  `SectorDataTable`, `CompetitionSelector`/`GroupSelector` (prop `idPrefix`), `TeamService.ts`,
  `shared/utils/goalSectors.ts`, tests.
- **Fuera de alcance**:
  - comparar equipos de **distintas temporadas** (la temporada sigue siendo única);
  - más de dos equipos;
  - corregir el parseo de minutos con añadido (`Convert.ToInt16("45+2")`) del handler, ni sustituirlo
    por `GoalSectorsAggregator`;
  - Mobile.
