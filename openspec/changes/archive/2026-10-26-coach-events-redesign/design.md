## Context

`Attendance.tsx` guarda el filtro (fechas, orden, página) en `sessionStorage` (`attendance_filter`) y
pide `getSportEvents(teamId, page, pageSize=10, start, end, descending)`. `EventCard` mezcla tres
cabeceras (partido, genérica, entrenamiento por tipo) y es la tarjeta del dashboard en modo `compact`.
La eliminación vive hoy solo en la tarjeta (`deleteSportEvent`, con `Dialog` propio y `alert()`).
`AttendanceEvent` ya permite editar (`SportEventDialog`) y usa `ConfirmDialog`.

## Goals / Non-Goals

**Goals:** ver la semana de un vistazo; filtros que no ocupan la pantalla; acciones destructivas fuera
de la lista; móvil primero, sin tablas.

**Non-Goals:** backend, tamaño de página, `SportEventDialog`, `AttendanceTabs`.

## Decisions

### D1 · Agrupación en el cliente: `utils/groupEventsByWeek.ts`
`groupEventsByWeek(events, now)` devuelve `[{ key, label, range, events }]` conservando el orden de
carga. Semana lunes–domingo. Etiquetas: «Esta semana», «Próxima semana», «Semana pasada» y
«Semana del 9 nov» para el resto. `now` se inyecta para tests deterministas. Una semana puede partirse
entre páginas (la paginación se mantiene): aceptado.

### D2 · Filtros
- Segmentos → rango y orden: **Próximos** = hoy → fin de temporada, ascendente; **Pasados** = inicio de
  temporada → ayer, descendente; **Toda la temporada** = inicio → fin, ascendente. «Próximos» es el
  segmento por defecto (reutiliza `getDefaultAttendanceDateRange`).
- Rango de fechas en un desplegable (`Popover`) con Desde/Hasta y «Aplicar»; aplicar un rango propio
  deja los segmentos sin marcar y sigue sin sobrescribirse al cambiar la temporada
  (`userModifiedDatesRef`).
- Chips de tipo filtran **en el cliente** la página cargada, por nombre de tipo (partido,
  entrenamiento, torneo); sin chips activos se muestran todos. La API no tiene parámetro de tipo.
- Persistencia en `sessionStorage` con la misma clave y un campo `segment` nuevo; claves antiguas sin
  `segment` se leen como rango personalizado.

### D3 · Tarjeta (`EventCard`)
- Toda la tarjeta es clicable con un **enlace superpuesto** (`<Link>` a `/coach/attendance/:id`, ruta
  absoluta, con `aria-label` «Abrir evento …» y `position:absolute; inset:0`), no un `<a>` envolvente:
  así el enlace del mapa de la ubicación no queda anidado en otro `<a>` (HTML inválido) y se coloca por
  encima (`position:relative; z-index:1`).
- Se eliminan acciones, `Dialog` de borrado, `SportEventDialog` y los props `onDeleted`/`onEdited`.
- `compact` ya no tiene consumidores en producción (el dashboard usa `NextEventCard`/`UpcomingEventRow`);
  se conserva el prop sin cambios de contrato para no ampliar el alcance.
- Se reutiliza `EventAttendanceBadges`, el chip «Llegada» y `ShieldImg`. Partido: bloque de fecha,
  escudos, marcador o «vs» + hora, resultado y Local/Visitante. Resto: título, etiqueta de tipo y, en
  entrenamientos, tipos de entrenamiento y estado de convocatoria.
- Altura según contenido (se elimina `grid-auto-rows: 384px`); rejilla `repeat(auto-fill, minmax(340px, 1fr))`,
  una columna en móvil.
- `compact` conserva su contrato y estilos. Los colores del diseño se mapean a tokens existentes
  (`--rffm-*`/tema MUI); los que no tengan equivalente se añaden como variables en `:root` de
  `muiGameTheme` (el tema del entrenador no se monta), previa aprobación.

### D4 · Eliminar en el detalle
Botón «Eliminar» (`color="error"`, `variant="outlined"`) junto a «Editar», con la misma condición
(`canEditEvent`). Abre `ConfirmDialog` («Eliminar evento»); al confirmar llama a `deleteSportEvent`
(con `processing`): éxito → snackbar «Evento eliminado» y `navigate` al listado del equipo; 404 →
snackbar «El evento ya no existe» y vuelta al listado; otro error → snackbar de error con `detail` o
«Error al eliminar el evento.» y se queda en la página.

## Risks / Trade-offs

- Mover el borrado quita un atajo de la lista: decisión del usuario.
- El filtro de tipo solo actúa sobre la página cargada: puede quedar vacía; se muestra el estado vacío
  con «Quitar filtros».
