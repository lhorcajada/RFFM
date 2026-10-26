## 1. Etapa 1 · Panel (~4h)

- [x] Red: `components/summary/__tests__/AttendanceDashboardTab.layout.test.tsx`: anillo con `aria-label` de la tasa, totales, tres tarjetas, categoría vacía con `EmptyState`, sin `<table>` (D2).
- [x] Green: `AttendanceDashboardTab.tsx`, `AttendanceEventChart.tsx` + CSS Module; actualizar `AttendanceEventChart.test.tsx` y `AttendanceDashboardTab.noPending.test.tsx`.
- **Verify**: `npx vitest run src/apps/coach/pages/attendance/components/summary`.

## 2. Etapa 2 · Entrenamientos (~4h)

- [x] Red: `AttendanceTrainingsTab.searchAndSort.test.tsx`: buscador, orden, porcentaje en texto, faltas desplegables, «Sin ausencias registradas»; los tests de exportar/foto existentes siguen en verde (D3).
- [x] Green: `AttendanceTrainingsTab.tsx` + CSS Module.
- **Verify**: `npx vitest run src/apps/coach/pages/attendance/components/summary/__tests__/AttendanceTrainingsTab`.

## 3. Etapa 3 · Partidos (~4h)

- [x] Red: `AttendanceMatchesTab.layout.test.tsx`: minutos de temporada, contadores no nulos, últimos 5, detalle con «Amistoso»; tests de PDF/minutos existentes en verde (D4).
- [x] Green: `AttendanceMatchesTab.tsx` + CSS Module.
- **Verify**: `npx vitest run src/apps/coach/pages/attendance`.

## 4. Cierre

- [ ] `npm run build` y `npm run test` en `Front/`; revisión visual a 390 px y escritorio.
- [ ] Subir versión web (minor por etapa).
