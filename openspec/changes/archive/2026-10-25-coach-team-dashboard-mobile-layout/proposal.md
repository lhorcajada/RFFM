## Why

El inicio del equipo (`/coach/team-dashboard`) es la página donde aterrizan jugadores y familias, pero
en móvil enseña poco y obliga a deslizar: dos carruseles («Próximos eventos» y «Últimas noticias»)
con tarjetas grandes, una por pantalla. El evento que importa (el siguiente) no destaca sobre los
demás, la respuesta a la convocatoria queda debajo de la tarjeta y no hay ningún dato de la liga. Al
entrenador tampoco le da el estado de la convocatoria de un vistazo ni accesos a lo que más usa.

Diseño de referencia: https://claude.ai/artifact/HZmUGEtauFc35ef4MkzK6z

## What Changes

- **Frontend (Coach, `Front/`)** — solo `/coach/team-dashboard`:
  - **Próximo evento destacado**: el primer evento futuro sale en una tarjeta propia con fecha, hora,
    llegada, lugar y rival.
    - Player/FamilyMember: su estado («Estás convocado · sin responder», «Vas», «No vas»,
      «¿Estás disponible?») y los botones «Voy» / «No voy» (o «Sí» / «No» en disponibilidad) dentro
      de la tarjeta.
    - Coach/Administrator: barra van / pendientes / no van, las cifras Convocados, Van, Pendientes y
      No van, y el botón «Gestionar convocatoria».
  - **«Después»**: los dos eventos siguientes en filas compactas con chip de estado (jugador) o % de
    asistencia / «Sin convocar» (entrenador), y el enlace «Ver calendario». El jugador puede seguir
    respondiendo desde la fila.
  - **Liga** (Player/FamilyMember con competición RFFM asociada): último resultado con G/E/P y
    posición con puntos y racha de los últimos cinco, enlazando a Resultados y Clasificación.
  - **Acciones rápidas** (Coach/Administrator): Plantilla, Lesionados y Resumen de asistencias, según
    permisos.
  - **Noticias**: lista de hasta tres filas con miniatura de 64 px, título y antigüedad, más «Ver
    todas», en lugar del carrusel.
  - **Cabecera**: «Ir al club» y «Volver» pasan a botones de icono.
  - Sin carruseles en la página. En escritorio, dos columnas.
  - **Versión**: web minor.

## Capabilities

### New Capabilities
- `coach-team-dashboard-mobile-layout`: próximo evento destacado, filas «Después», bloque Liga y
  acciones rápidas del inicio del equipo.

### Modified Capabilities
- `coach-dashboard-widgets`: los eventos y las noticias dejan de ser carruseles de tarjetas; la
  noticia pasa a fila compacta con miniatura en vez de tarjeta con media altura de imagen y cuerpo.

## Impact

- `Front/src/apps/coach/pages/team-dashboard/`: `TeamDashboard.tsx` + CSS,
  `components/UpcomingEventsWidget.tsx`, `components/NewsWidget.tsx`; nuevos `NextEventCard`,
  `UpcomingEventRow`, `LeagueSnapshot`, `QuickActions`, `NewsRow`, `StatusChip`, `EventLocation` y
  `utils/eventDisplay.ts`, `utils/leagueSnapshot.ts`, `utils/playerActions.ts`; tests en `__tests__/`.
- Reutiliza `useClassification`, `useRffmSeason`, `usePermissions` y `buildTeamSections`; sin
  cambios de backend ni de API.
- **Fuera de alcance**: el panel general (`/coach/dashboard`), la barra de navegación del equipo y el
  aviso de notificaciones push (se mantiene tal cual encima de todo).
