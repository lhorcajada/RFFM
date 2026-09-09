## Why

La pestaña "Plantilla" (`Front/coach/squad?teamId=`) ya muestra fichas de jugador con
valoraciones, pero no hay ningún sitio donde el entrenador vea de un vistazo goles,
tarjetas, minutos jugados ni un indicador de frescura física de cada jugador. Ya existen
piezas sueltas para construir esto (`GetSeasonPlayerStats`, `GetPlayerSeasonCards`,
`GetTrainingAttendanceSummary`) pero ninguna combina asistencia a entrenamientos + minutos
de partido en un indicador único, ordenable, con desglose de motivo de ausencia. Sin esto,
el entrenador no tiene forma objetiva de detectar qué jugadores llevan poca carga reciente
de entrenamiento o partido antes de convocar.

## What Changes

- Backend: nuevo endpoint `GET /api/catalog/team/{teamId}/player-stats` (feature
  `GetTeamPlayerStatistics`) que devuelve, por jugador de la plantilla: dorsal, goles,
  amarillas, rojas y minutos jugados (temporada completa, reutilizando los patrones de
  `GetSeasonPlayerStats`/`GetPlayerSeasonCards`), más el nuevo campo `formStatus`
  (0-100, ventana móvil de 8 semanas) y `formStatusBreakdown` (últimas ausencias con motivo,
  igual que `AbsenceDetail` de `GetTrainingAttendanceSummary`).
- Backend: nuevo `PlayerFormStatusCalculator` (servicio de dominio/feature) que implementa el
  algoritmo de estado de forma: 70% asistencia a entrenamiento / 30% minutos de partido,
  baseline de plena forma = 16 entrenamientos + 8 partidos convocados en 8 semanas,
  penalización por ausencia según motivo (lesión > injustificada > justificada media >
  tarde), decisión técnica del entrenador sin penalización.
- Frontend: nueva pestaña "Estadísticas" en `Squad.tsx`, con tabla ordenable (dorsal, goles,
  amarillas, rojas, minutos, estado de forma), filtro por posición, tooltip de desglose de
  estado de forma, y botón de exportar/imprimir PDF (nuevo `squadStatsPdfExport.ts`, mismo
  patrón que `squadPdfExport.ts`).

**Non-goals**: no se persiste el `formStatus` (se calcula al vuelo en cada petición); no se
modela un histórico de evolución del estado de forma en el tiempo; no se toca el registro de
lesiones (`TeamPlayerInjury`) ni el flujo de sanciones; la ventana de 8 semanas y el baseline
de 16 entrenamientos/8 partidos quedan como constantes de configuración simples, no
parametrizables por equipo en esta iteración.

## Capabilities

### New Capabilities
- `player-form-status`: cálculo derivado (no persistido) del estado de forma de un jugador
  a partir de asistencia a entrenamientos y minutos jugados en partidos de las últimas 8
  semanas, con desglose de motivos de ausencia recientes.
- `squad-statistics-tab`: pestaña de estadísticas de plantilla ordenable y filtrable por
  posición, con exportación a PDF.

## Impact

- Backend: nuevo archivo `Features/Coaches/Players/Queries/GetTeamPlayerStatistics.cs`
  (endpoint + query + handler + `PlayerFormStatusCalculator` embebido o en
  `Features/Coaches/Players/Services/`); tests nuevos en
  `Features/Coaches/Players/Queries/GetTeamPlayerStatistics.Tests.cs`.
- Frontend: `Front/src/apps/coach/pages/squad/Squad.tsx` (nueva pestaña), nuevo
  `apps/coach/pages/squad/components/SquadStatistics.tsx` +
  `SquadStatistics.module.css`, nuevo `apps/coach/services/teamPlayerStatisticsService.ts`,
  nuevo `apps/coach/pages/squad/squadStatsPdfExport.ts`; tests Vitest co-ubicados en
  `__tests__/`.
