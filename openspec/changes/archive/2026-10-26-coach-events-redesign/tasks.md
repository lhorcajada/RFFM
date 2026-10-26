## 1. Lógica pura (~1h)

- [x] Red: `utils/__tests__/groupEventsByWeek.test.ts`: esta semana / próxima / pasadas / posteriores, rangos lunes–domingo, `now` fijo, orden conservado, lista vacía (D1).
- [x] Green: `utils/groupEventsByWeek.ts`.
- **Verify**: `npx vitest run src/apps/coach/pages/attendance/utils`.

## 2. Barra de filtros (~2h)

- [x] Red: `components/__tests__/EventsFilterBar.test.tsx`: segmentos con `aria-pressed`, chips de tipo, desplegable de fechas con «Aplicar», rango propio desmarca segmentos (D2).
- [x] Green: `components/EventsFilterBar.tsx` + CSS Module.
- **Verify**: `npx vitest run src/apps/coach/pages/attendance/components`.

## 3. Tarjeta (~3h)

- [x] Red: `__tests__/EventCard.link.test.tsx`: enlaza a `/coach/attendance/:id`; sin botones de editar/eliminar/asistencias/ir al partido; enlace de mapa sin navegar (D3).
- [x] Red: `__tests__/EventCard.match.test.tsx` y `EventCard.training.test.tsx`: marcador, «vs» + hora, resultado, local/visitante; entrenamiento con tipos y convocatoria; chip «Llegada».
- [x] Red: `__tests__/EventCard.compact.test.tsx`: el modo `compact` no cambia.
- [x] Green: `EventCard.tsx` + `EventCard.module.css`.
- **Verify**: `npx vitest run src/apps/coach/pages/attendance src/apps/coach/pages/Dashboard`.

## 4. Página de lista (~3h)

- [x] Red: actualizar `Attendance.*.test.tsx` existentes y añadir `Attendance.grouping.test.tsx` y `Attendance.filters.test.tsx`: grupos por semana, «Próximos» por defecto, chips filtran en cliente, vacío con «Quitar filtros», paginación (D1, D2).
- [x] Green: `Attendance.tsx` + `Attendance.module.css` (una columna en móvil, «Nuevo evento» en cabecera).
- **Verify**: `npx vitest run src/apps/coach/pages/attendance`.

## 5. Eliminar en el detalle (~2h)

- [x] Red: `__tests__/AttendanceEvent.deleteButton.test.tsx`: botón solo con rol de edición, `ConfirmDialog`, éxito → snackbar y vuelta al listado, 404, otro error se queda (D4).
- [x] Green: `AttendanceEvent.tsx`.
- **Verify**: `npx vitest run src/apps/coach/pages/attendance/__tests__/AttendanceEvent`.

## 6. Cierre (~1h)

- [x] Subir la versión minor de la web (`Front/package.json`).
- [x] `npm run build` + `npx vitest run --maxWorkers=2`.
- [x] `openspec validate coach-events-redesign --strict`.
- [x] Comprobación visual a ~360 px y en escritorio (lista, filtros, detalle).
- [x] Commits tras confirmación del usuario.
