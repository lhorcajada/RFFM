## 1. Lógica pura (~1h)

- [x] Red: `team-dashboard/utils/__tests__/eventDisplay.test.ts`: `eventStart`, `dateBadge`, `relativeDayLabel` (hoy, mañana, día de la semana, fecha), `timeLine`, `myStatusLabel` por estado y `coachSummaryLine` (D2).
- [x] Red: `team-dashboard/utils/__tests__/leagueSnapshot.test.ts`: equipo propio no encontrado, solo partidos jugados, último partido, racha de cinco y equipo sin partidos jugados (D4).
- [x] Green: `utils/eventDisplay.ts` y `utils/leagueSnapshot.ts`.
- **Verify**: `npx vitest run src/apps/coach/pages/team-dashboard/utils`.

## 2. Eventos (~2h)

- [x] Red: `components/__tests__/NextEventCard.test.tsx`: nombre, horario, lugar con mapa, estado del jugador con «Voy» / «No voy», «Sí» / «No» en disponibilidad, cifras y «Gestionar convocatoria» del entrenador, «Aún no hay convocados» (D3).
- [x] Red: `components/__tests__/UpcomingEventRow.test.tsx`: fecha, nombre enlazado al detalle, chip del jugador, línea del entrenador, botones de icono con su nombre accesible (D1).
- [x] Red: actualizar `UpcomingEventsWidget*.test.tsx`: primer evento en «Próximo evento», siguientes en «Después», sin carrusel; las acciones optimistas, los diálogos y los errores siguen pasando.
- [x] Green: `NextEventCard`, `UpcomingEventRow` + CSS Modules y render nuevo de `UpcomingEventsWidget` (D1–D3).
- **Verify**: `npx vitest run src/apps/coach/pages/team-dashboard/components`.

## 3. Liga, acciones rápidas y noticias (~2h)

- [x] Red: `components/__tests__/LeagueSnapshot.test.tsx`: posición, puntos, último resultado, racha, enlaces con `teamId`; no se pinta sin competición, sin equipo propio ni para el entrenador (D4).
- [x] Red: `components/__tests__/QuickActions.test.tsx`: solo los ítems con permiso; nada si no hay ninguno (D5).
- [x] Red: actualizar `NewsWidget.test.tsx`: filas con enlace al detalle, antigüedad, «Ver todas», sin carrusel (D6).
- [x] Green: `LeagueSnapshot`, `QuickActions`, `NewsRow` + CSS Modules y `NewsWidget` (D4–D6).
- **Verify**: `npx vitest run src/apps/coach/pages/team-dashboard`.

## 4. Página y cierre (~1h)

- [x] Red: actualizar `TeamDashboard.test.tsx`: Liga solo para jugador, acciones rápidas solo para entrenador, «Ir al club» y «Volver» como botones de icono (D7).
- [x] Green: `TeamDashboard.tsx` + `TeamDashboard.module.css` (D7).
- [x] Quitar estilos sin uso de `UpcomingEventsWidget.module.css` y `NewsWidget.module.css`.
- [x] Subir la versión minor de la web (`Front/package.json`) sobre la versión de `main`.
- [ ] `npm run build` + `npx vitest run --maxWorkers=2`.
- [x] `openspec validate coach-team-dashboard-mobile-layout --strict`.
- [x] Comprobación visual a ~360 px (jugador y entrenador) y en escritorio.
- [x] Commits tras confirmación del usuario.
