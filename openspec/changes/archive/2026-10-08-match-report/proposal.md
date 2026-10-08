## Why

Cuando un partido termina, el entrenador, los jugadores y los familiares no tienen un sitio donde
consultar lo que pasó: el acta de federación solo se ve en la app de Federación y los datos que el
entrenador registra en el «Partido en directo» (alineación, minutos, goles, tarjetas, cambios) solo
se ven desde la pantalla de directo, que no está disponible para jugadores ni familias.

## What Changes

- **Botón «Ver acta»** en las tarjetas de partido finalizado de:
  - Front (coach): Calendario (`Convocations` → `MatchCard`/`AgendaList`) y Resultados (`RoundPanel`,
    solo en el partido del propio equipo).
  - Mobile: Calendario, Amistosos, Torneos (`EventCard`) y Liga (`LeagueScreen`, solo en el partido
    del propio equipo).
- **Regla de visibilidad** (calculada en backend, única fuente de verdad):
  - partido en directo **finalizado y guardado** → botón visible; pestañas «Federación» (si es liga
    con acta RFFM) y «Partido en directo»;
  - sin partido en directo, partido de liga finalizado con acta RFFM → botón visible, solo pestaña
    «Federación»;
  - amistoso/torneo sin partido en directo → sin botón.
- **Pantalla «Acta del partido»** (Front y Mobile) con dos pestañas, accesible para Coach,
  Administrador, Jugador y Familiar del equipo:
  - **Federación**: el acta RFFM, reutilizando los componentes de acta de Federación en Front.
  - **Partido en directo**: campo con titulares en su posición (esquema inicial) y banquillo, minutos
    de cada jugador, goles con minuto en orden cronológico, tarjetas y ventanas de cambios
    (descanso + hasta cuatro ventanas).
- **Backend (`Back/ExtractionApi`)**:
  - `GET /api/teams/{teamId}/match-reports`: índice de partidos con acta disponible.
  - `GET /api/events/{eventId}/match-report`: cabecera + datos del partido en directo ya resueltos
    (nombres, dorsales, fotos, posiciones).
  - `GET /api/events/{eventId}/federation-acta`: acta RFFM resuelta con la competición/grupo del equipo.
  - El guardado del partido en directo pasa a persistir la **alineación inicial** (esquema + huecos),
    con fallback a la alineación guardada del evento para partidos antiguos. Migración nueva.
- **Versiones**: API minor, Web minor, Mobile minor.

## Capabilities

### New Capabilities
- `match-report`: consulta del acta (federación y partido en directo) de partidos finalizados.

## Impact

- `Back/ExtractionApi`: `Features/Coaches/MatchReports/` (3 features), `SaveMatchParticipation.cs`,
  `MatchParticipation` (+ columna `StartingLineupJson`), migración, tests.
- `Front`: componentes de acta movidos de `apps/federation/components/acta/` a
  `shared/components/acta/`, nueva página `apps/coach/pages/matchReport/`, `MatchCard`, `AgendaList`,
  `Results`, `RoundPanel`, `matchReportService.ts`, `useLiveMatch.ts` (envía alineación inicial).
- `Mobile`: `MatchReportScreen`, `api/matchReports.ts`, `EventCard`, `LeagueScreen`, navegación.
- **Fuera de alcance**: editar el acta desde esta pantalla; valoraciones/competitividad de la
  pestaña de directo; cambios de esquema a mitad de partido en el dibujo del campo (se muestra el
  esquema inicial); notificaciones de «acta disponible».
