## 1. Lógica pura (~1h)

- [x] Red: `utils/__tests__/positionGroups.test.ts`: `positionTagOf` y `sortByPosition` (orden de grupos, estable, «Sin posición» al final) (D4).
- [x] Red: `utils/__tests__/ownPlayerEntry.test.ts`: cada `kind`, orden de búsqueda y sin jugador asociado (D5).
- [x] Green: `positionGroups.ts` y `ownPlayerEntry.ts`.
- **Verify**: `npx vitest run src/apps/coach/pages/attendance/utils`.

## 2. Fila compacta (~2h)

- [x] Red: `components/__tests__/PlayerRow.test.tsx`: nombre, dorsal, etiqueta de posición, chip de estado, enlace al detalle, checkbox de selección con su `aria-label` (D1).
- [x] Red: `PositionGroupedList.test.tsx`: sin cabeceras, orden por posición (D4).
- [x] Red: `ConvocationCard.test.tsx`: aceptado del entrenador abre el menú «⋮» con «Desconvocar» y «Lista de espera»; pendiente con «Aceptar» / «Rechazar» (D2).
- [x] Green: `PlayerRow` + CSS Module, tokens de estado en `muiGameTheme.ts`, `PositionGroupedList`, `ConvocationCard`, `AvailabilityList`, `NotConvokedList` y lesionados (D1–D3).
- **Verify**: `npx vitest run src/apps/coach/pages/attendance/components`.

## 3. «Tu jugador» y resumen (~2h)

- [x] Red: `components/__tests__/OwnPlayerCard.test.tsx`: chip y acciones por `kind` (D5).
- [x] Red: `__tests__/AttendanceTabs.ownPlayerFirst.test.tsx`: Player/FamilyMember ve a su jugador en «Tu jugador» y no en su grupo; el contador del grupo lo excluye; el entrenador no ve «Tu jugador».
- [x] Red: `__tests__/AttendanceTabs.summary.test.tsx`: cifras de Convocados, Van, Pendientes y Bajas (D6).
- [x] Red: actualizar `AttendanceTabsGroupsDefaultState.test.tsx`: Player/FamilyMember abre «Aceptados» (D7).
- [x] Green: `OwnPlayerCard`, `ConvocationSummary` y cambios en `AttendanceTabs.tsx` (D5–D7).
- [x] Red: `components/__tests__/EventInfoCard.test.tsx` (horario, «Por confirmar», mapa, rival, «Ver más») (D9).
- [x] Green: `EventInfoCard` + CSS Module en `AttendanceEvent.tsx` y limpieza de clases `info*` (D9).
- **Verify**: `npx vitest run src/apps/coach/pages/attendance`.

## 4. Regresión y cierre (~1h)

- [x] Ajustar los tests existentes de `attendance/__tests__` que dependan de cabeceras de posición, `highlighted` o del marcado de la tarjeta cromo (sin cambiar el comportamiento que verifican).
- [x] Limpiar las clases `cromo*` sin uso en `AttendanceTabs.module.css` (D3).
- [x] Subir la versión minor de la web (`Front/package.json`).
- [x] `npm run build` + `npx vitest run --maxWorkers=2`.
- [x] `openspec validate coach-convocation-mobile-layout --strict`.
- [x] Comprobación visual a ~360 px (jugador y entrenador) y en escritorio.
- [x] Commits tras confirmación del usuario.
