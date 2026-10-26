## Why

La página «Eventos deportivos» del entrenador (`/coach/attendance`) es una rejilla plana de tarjetas de
altura fija (384 px) con un formulario de filtros siempre visible (Desde, Hasta, orden, Buscar, Limpiar)
y cuatro iconos de acción por tarjeta (ir al partido, asistencias, editar, eliminar). Es difícil ver de
un vistazo qué viene esta semana, y las acciones destructivas están a un toque de distancia en móvil.

Diseño de referencia: https://claude.ai/artifact/B83oYPssnQVqxWnafDJn7B

## What Changes

- **Frontend (Coach, `Front/`)**:
  - **Lista agrupada por semana**: «Esta semana», «Próxima semana», semanas posteriores y pasadas, cada
    grupo con su rango de fechas. Se mantiene la paginación del backend.
  - **Barra de filtros compacta**: control segmentado Próximos / Pasados / Toda la temporada, chips de
    tipo (Partidos, Entrenamientos, Torneos) y el rango de fechas dentro de un desplegable (sustituye al
    formulario Desde/Hasta/orden/Buscar/Limpiar).
  - **Tarjeta rediseñada**: bloque de fecha y hora a la izquierda, franja de color por tipo, rival y
    marcador en partidos, lugar, hora de llegada y badges de asistencia (el componente actual). Toda la
    tarjeta es un enlace al evento. Se quitan los iconos de acciones (asistencias, editar, eliminar, ir
    al partido) y la altura fija.
  - **Modo `compact`** (widget «Próximos eventos» del dashboard): sigue funcionando.
  - **Responsive**: una columna en móvil, objetivos táctiles de 44 px, «Nuevo evento» en la cabecera.
  - **Eliminar evento** pasa a la página de detalle (`AttendanceEvent`), junto a «Editar», con
    `ConfirmDialog` y aviso por `rffm.show_snackbar` (se elimina el `alert()` de la tarjeta). Tras
    eliminar se vuelve al listado.
  - **Versión**: web minor.

## Capabilities

### New Capabilities
- `coach-events-page`: lista de eventos agrupada por semana y filtros compactos.
- `coach-event-detail`: eliminar el evento desde su página de detalle.

### Modified Capabilities
- `coach-event-card-layout`: la tarjeta pasa a ser un enlace al evento sin iconos de acción, con
  etiqueta de tipo y altura según contenido.

## Impact

- `Front/src/apps/coach/pages/attendance/`: `Attendance.tsx` + `Attendance.module.css`, `EventCard.tsx` +
  `EventCard.module.css`, `AttendanceEvent.tsx`; nuevos `components/EventsFilterBar` y
  `utils/groupEventsByWeek.ts`, con sus tests.
- `EventCard` lo usa también el dashboard (`compact`): sus tests deben seguir en verde.
- Sin cambios de backend ni de API (`deleteSportEvent` ya existe).
- **Fuera de alcance**: tamaño de página, `SportEventDialog` y el contenido de `AttendanceTabs`.
