## Why

En «Resultados» del entrenador (`/coach/results`) el partido del propio equipo se mezcla con el resto
de la jornada, agrupado por sábado/domingo: hay que buscarlo. Además, las jornadas son pestañas de MUI
encima de la lista; al hacer scroll vertical desaparecen y para cambiar de jornada hay que volver arriba.
Tampoco hay una vista rápida de cómo va la temporada del equipo.

Diseño de referencia: https://claude.ai/artifact/BvGbDfVAwE5oTx2ExxcRre

## What Changes

- **Frontend (Coach, `Front/`)** — solo la página «Resultados»:
  - **Barra de jornadas fija** que sustituye a las pestañas: se queda pegada arriba del área de scroll,
    con flechas anterior/siguiente, una ficha por jornada (J1…Jn) y el botón «Jornada actual». Cada
    ficha de una jornada jugada lleva la letra del resultado del equipo (V/E/D); las no jugadas, la
    fecha. La seleccionada se centra sola.
  - **«Tu partido»**: el partido del equipo del usuario en la jornada seleccionada se muestra siempre
    primero, en una tarjeta destacada (escudos, marcador u hora, fecha, campo, resultado y «Ver acta»).
    Si el equipo descansa, la tarjeta lo indica.
  - **«Resto de la jornada»**: el resto de partidos en tarjetas compactas, cada una con «Ver acta».
  - **«Tu temporada»** (escritorio): panel lateral con todas las jornadas del equipo (rival,
    casa/fuera, resultado) y el balance V/E/D y goles; cada fila selecciona su jornada. Sin scroll
    propio: usa el de la página.
  - **Nombres y escudos**: nombres completos de los equipos (sin puntos suspensivos, en varias líneas
    si hace falta) y escudo de cada equipo en todas las tarjetas y en el panel.
  - **Avisos de resultados**: el interruptor que ocupaba una tarjeta encima del contenido pasa a una
    campana de 44 px junto a «Volver»; al pulsarla se abre un panel con el interruptor y la ayuda.
  - **Suspendidos**: etiqueta «Suspendido» en los partidos suspendidos; no cuentan como jugados.
  - **Datos**: el calendario completo (`GET /calendar`, ya existente) da los partidos propios de todas
    las jornadas para la barra y el panel; la jornada seleccionada sigue saliendo de
    `GET /calendar/matchday` (datos al día), que tiene prioridad sobre el calendario completo.
  - **Versión**: web minor.

## Capabilities

### New Capabilities
- `coach-results-page`: barra de jornadas fija, partido propio destacado, resto de la jornada y panel
  de temporada en «Resultados».

### Modified Capabilities
- `match-result-notifications`: el interruptor de avisos pasa a ser una campana compacta en la barra
  de acciones que abre un panel con el interruptor.

## Impact

- `Front/src/apps/coach/pages/results/`: `Results.tsx` + `Results.module.css`; nuevos
  `components/RoundRail`, `components/OwnMatchCard`, `components/RoundMatchList`,
  `components/SeasonPanel`, `components/TeamCrest`, `components/OutcomeBadge`,
  `hooks/useOwnTeamSeason.ts`, `utils/ownMatch.ts` y `utils/matchDates.ts`, con sus tests.
- `shared/hooks/useCalendar.ts`, `RoundPanel` y `MatchDay` no cambian (los usan otras páginas).
- Sin cambios de backend ni de API.
- **Fuera de alcance**: clasificación dentro de la página, partidos en directo y la página de
  calendario de Federación.
