## Why

La ficha del jugador y Estadísticas de plantilla muestran Estado de forma, Rodaje y Cansancio
**solo con el valor de hoy**. El entrenador no puede ver cómo han cambiado: si un jugador viene
subiendo tras una lesión, si el Cansancio se ha disparado esta semana o si el Rodaje cae porque
lleva días sin entrenar. Las tres métricas se calculan cada vez a partir de los eventos (asistencia a
entrenos y minutos de partido); no se guardan en BD. Por eso se puede reconstruir su valor de
cualquier día pasado sin guardar snapshots ni programar un job nocturno.

## What Changes

- **Backend**: nuevo endpoint
  `GET /api/catalog/team/{teamId}/players/{teamPlayerId}/physical-evolution?days=28|56|84`. Devuelve
  una serie diaria (Forma, Rodaje, Cansancio) desde hace `days − 1` días hasta hoy. Añade también los
  entrenos y partidos de cada día y las lesiones del periodo. Cada punto es el valor que daría el
  cálculo actual para ese día con los datos actuales; el último punto coincide con el de
  Estadísticas de plantilla.
- **Backend (refactor)**: se extrae la construcción de entradas del modelo de carga, hoy dentro de
  `GetTeamPlayerStatistics`, a un helper puro compartido. `DailyLoadModel` pasa a poder cerrar un día
  pasado como día de descanso completo.
- **Frontend (Coach)**: sección «Evolución física» en la pestaña Estadísticas de la ficha del jugador.
  Gráfico de líneas con `@mui/x-charts`, selector 4/8/12 semanas, marcas de partidos y lesiones,
  detalle del día seleccionado y un resumen textual con la variación del periodo. En Estadísticas de
  plantilla, un enlace «Ver evolución» en cada tarjeta lleva a la ficha.
- **Dependencia nueva**: `@mui/x-charts@^7.29.1`. Es la última rama compatible con MUI v5 y React 19.

## Capabilities

### New Capabilities
- `player-physical-evolution`: serie diaria reconstruida de Forma/Rodaje/Cansancio por jugador y su
  visualización en la ficha.

## Impact

- `Back/ExtractionApi`: `Features/Coaches/Players/Queries/GetPlayerPhysicalEvolution.cs` (nuevo),
  `Services/PlayerLoadInputsBuilder.cs` (nuevo), `Services/DailyLoadModel.cs`,
  `Queries/GetTeamPlayerStatistics.cs` (usa el helper sin cambiar su comportamiento).
- `Front/` (solo Coach): `teamPlayerStatisticsService.ts`, ficha del jugador (nuevo componente y hook),
  `SquadStatistics.tsx`, `package.json`.
- Sin migraciones ni cambios en BD.
- **Fuera de alcance**: snapshots o «lo que marcaba ese día» (la historia se recalcula si se corrige
  una asistencia o cambian los parámetros del modelo), comparar varios jugadores en un gráfico,
  sparklines en la plantilla, Mobile (Expo) y exportación a PDF.
