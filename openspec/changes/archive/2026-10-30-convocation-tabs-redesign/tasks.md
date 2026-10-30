## 1. Fila compacta de jugador (~1.5h)

- [x] Red: `components/__tests__/ConvocationPlayerRow.test.tsx` (nombre, dorsal y posición; valoración media con su color; racha; etiquetas Lesionado y En recuperación; barras de forma; slot de acciones).
- [x] Green: `ConvocationPlayerRow.tsx` + `ConvocationPlayerRow.module.css` (D2, D5).
- **Verify**: `npx vitest run src/apps/coach/pages/convocations/components/__tests__/ConvocationPlayerRow`.

## 2. Pestaña Convocatoria (~2h)

- [x] Red: `ConvocationTab.summary.test.tsx` (un contador por zona, también en liga) y `ConvocationTab.touchActions.test.tsx` («Desconvocar a X» llama a `onDeconvokePlayer`; «Convocar a X» llama a `onCallPlayers([id])`; sin los props no hay botones).
- [x] Red: adaptar `ConvocationTab.formStatus/readiness/calledAvg/groups/bulkCall/markAvailable` a la fila compacta, manteniendo lo que verifican.
- [x] Green: `ConvocationTab.tsx` y `ConvocationTab.module.css` con `ConvocationPlayerRow`, resumen, acciones táctiles y columnas en escritorio (D3, D5).
- [x] Conectar `onDeconvokePlayer` y `onCallPlayers` desde `ConvocationMatchDetail` a `convocation.moveToNotCalled` / `handleCallPlayers`.
- **Verify**: `npx vitest run src/apps/coach/pages/convocations/components/__tests__/ConvocationTab`.

## 3. Pestaña Desconvocatorias (~2h)

- [x] Red: `DesconvocatoriasTab.cards.test.tsx` (sin `table`; un chip por causa con su contador; una tarjeta por jugador con las tres cifras rotuladas; chips «J{n} · causa» por partido; orden por total; «Desconvocar» y etiqueta «Desconvocado»; cargando y vacío) y adaptar `DesconvocatoriasTab.sanctionBadge.test.tsx`.
- [x] Green: `DesconvocatoriasTab.tsx` y `DesconvocatoriasTab.module.css` sin tabla (D4, D5).
- **Verify**: `npx vitest run src/apps/coach/pages/convocations/components/__tests__/DesconvocatoriasTab`.

## 4. Barra de pestañas (~1h)

- [x] Red: ampliar `ConvocationMatchDetail.tabsAndProposal.test.tsx` (orden y nombres accesibles sin cambios; contadores presentes y `aria-hidden`) y `utils/__tests__/deconvocationStats.test.ts` (jugadores desconvocados alguna vez).
- [x] Green: estilo de pastillas y contadores en `ConvocationMatchDetail.tsx` / `.module.css` (D1).
- **Verify**: `npx vitest run src/apps/coach/pages/convocations/__tests__/ConvocationMatchDetail`.

## 5. Historial de desconvocatorias por jugador (~2h)

- [x] Red: `DesconvocatoriasTab.history.test.tsx` (tira con una celda por partido y las faltas marcadas; 3 últimas en filas de la más reciente a la más antigua; «Ver las N restantes» solo con más de 3 y revela el resto; botones por causa con `aria-pressed` que filtran y «Quitar filtro»; «Mostrando n de N»; insignia de sanción en la fila) y adaptar `DesconvocatoriasTab.cards` / `sanctionBadge` (ya no hay chips por partido).
- [x] Green: `DesconvocatoriasTab.tsx` y su CSS Module (D7).
- **Verify**: `npx vitest run src/apps/coach/pages/convocations/components/__tests__/DesconvocatoriasTab`.

## 6. Zonas vacías plegadas en Convocatoria (~1.5h)

- [x] Red: `ConvocationTab.emptyZones.test.tsx` (zonas vacías como botones con `aria-expanded=false` y contador 0, sin columna; pulsar despliega; zona con jugadores sigue como columna; soltar sobre una zona plegada la despliega y mueve al jugador) y revisar los tests existentes que busquen cabeceras de zonas vacías.
- [x] Green: `ConvocationTab.tsx` y `ConvocationTab.module.css` (D8).
- **Verify**: `npx vitest run src/apps/coach/pages/convocations/components/__tests__/ConvocationTab`.

## 7. Verificación final

- [x] Subir la versión minor de la web (`Front/package.json`: 1.99.0 → 1.100.0; no se vuelve a subir al ser el mismo cambio sin commitear).
- [x] Suite completa `npx vitest run --maxWorkers=2` y `npm run build` (una sola vez, al terminar).
- [x] Comprobación visual a 390 px y a escritorio, incluidos el historial de desconvocatorias y las zonas vacías plegadas (confirmada por la persona usuaria).
- **Verify**: `openspec validate convocation-tabs-redesign --strict`.
