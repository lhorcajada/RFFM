## 1. Nuevo componente `CompactBenchCard` (TDD)

- [ ] 1.1 Escribir tests (Red) para `CompactBenchCard.tsx` (nuevo): renderiza foto/iniciales,
      dorsal, nombre; muestra etiqueta de minutos solo si `minutesPlayed > 0`; muestra badge
      "SALE" solo si `isLeaving`; no muestra competitividad, racha ni barras de forma.
      `DraggableCompactBenchCard` envuelve la tarjeta en `useDraggable({ id:
      "sim-player-{id}" })` (requiere `DndContext` ancestro en el test).
- [ ] 1.2 Crear `Front/src/apps/coach/pages/convocations/components/simulation/CompactBenchCard.tsx`
      (+ `.module.css` mínimo para el contenedor de lista), reutilizando las clases
      `.playerCard`/`.playerCardInner`/`.playerPhoto`/`.playerInitials`/`.dorsalBadge`/
      `.playerName`/`.minuteTag`/`.leavingBadge` de `SimulationPlayerSlot.module.css` (Green).
- [ ] 1.3 Verificar cobertura ≥75% del código nuevo.

## 2. Panel lateral (`.sidePanel`) pasa a tarjetas compactas — `SimulacionTab.tsx`

- [ ] 2.1 Actualizar/reemplazar `SimulacionTab.benchDraggable.test.tsx` (de la iteración
      anterior, comprobaba la tarjeta rica arrastrable) para que compruebe la tarjeta
      **compacta** arrastrable en `prepareMode` (wrapper de `CompactBenchCard`, no
      `BenchPlayerCard`/`benchDragHandle`) — debe fallar contra el código actual (Red).
- [ ] 2.2 Sustituir en `.sidePanel` el uso de `DraggableBenchCard`/`BenchPlayerCard`/
      `groupBenchPlayers` por una lista plana (`flex-wrap`, sin agrupar por posición) de
      `DraggableCompactBenchCard` (en `prepareMode`, dentro de `DroppableBench`) o
      `CompactBenchCard` estático (fuera de `prepareMode`) (Green).
- [ ] 2.3 Retirar de `.sidePanel` el `panelLegend`/`PlayerFormLegend` (ya no aplica a la tarjeta
      compacta) — se traslada al bloque informativo (tarea 4).
- [ ] 2.4 Confirmar que `handleDragStart`/`handleDragEnd` y el flujo `movePreparePlayer`/
      `movePreparePlayerToBench` siguen funcionando sin cambios (no deberían requerir edición).

## 3. Panel lateral compacto — `PartidoEnDirectoTab.tsx`

- [ ] 3.1 Repetir 2.1–2.4 en `PartidoEnDirectoTab.tsx`, incluyendo el caso
      `freeRepositionEnabled` (debe seguir arrastrando directamente sobre tarjetas del campo, sin
      pasar por el banquillo).

## 4. Bloque informativo siempre visible ("En el campo" + "Banquillo" ricos)

- [ ] 4.1 Actualizar `SimulacionTab.onFieldPanel.test.tsx` y crear un test equivalente para el
      nuevo listado informativo "Banquillo" (rico, solo lectura, mismos jugadores que el
      banquillo compacto) — deben fallar contra el código actual si la estructura cambió (Red
      donde aplique).
- [ ] 4.2 Sacar el bloque de "En el campo" (ya existente) de `.rightColumn`/`.main` y convertirlo
      en un hermano de `.main` a todo lo ancho, sin `display: none` por defecto (siempre
      visible). Añadir junto a él un nuevo listado "Banquillo" rico y de solo lectura
      (`BenchPlayerCard` + `groupBenchPlayers`, sin `DraggableBenchCard`/`DroppableBench`),
      mostrando los mismos jugadores que el panel lateral compacto (`prepareBenchPlayers`/
      `benchPlayers` según `prepareMode`).
- [ ] 4.3 Mover el `panelLegend`/`PlayerFormLegend` (retirado del `.sidePanel` en la tarea 2) a
      este bloque informativo, mostrado una única vez. Verificar que
      `SimulacionTab.legend.test.tsx`/`PartidoEnDirectoTab.legend.test.tsx` (existentes) siguen
      en verde sin cambios.
- [ ] 4.4 Repetir 4.1–4.3 en `PartidoEnDirectoTab.tsx`.

## 5. CSS — simplificar el layout responsive

- [ ] 5.1 En `SimulacionTab.module.css`: eliminar `.benchListsRow` y la media query
      `@media (min-width: 781px) and (max-width: 1200px)` (ya no aplican — la estructura que
      envolvían deja de existir).
- [ ] 5.2 Restaurar `.sidePanel` a vivir directamente en `.rightColumn` (como antes de la
      iteración de tablet), con un `max-height` + `overflow-y: auto` modesto y constante (sin
      media query) como red de seguridad, ya no crítico al ser tarjetas compactas.
- [ ] 5.3 Eliminar `display: none` por defecto de `.onFieldPanel` (ahora siempre visible); crear
      `.benchInfoPanel` (o renombrar consistentemente) para el nuevo listado rico "Banquillo",
      con el mismo tratamiento visual que `.onFieldPanel`.
- [ ] 5.4 Crear el contenedor `flex-wrap` a todo lo ancho (hermano de `.main`) que agrupa
      "En el campo" + "Banquillo" informativos, cada uno `flex: 1 1 320px`, sin `max-height`
      propio (se permite crecer; scroll de página como fallback).
- [ ] 5.5 Revisar que la media query móvil existente (`max-width: 780px`) sigue apilando
      correctamente campo + banquillo compacto, y que el nuevo bloque informativo permanece
      visible y accesible debajo.
- [ ] 5.6 Verificar visualmente (DevTools responsive) en un ancho de escritorio (~1280px), tablet
      (iPad 10", apaisado y vertical) y móvil (~375px).

## 6. Limpieza de tests obsoletos de la iteración anterior

- [ ] 6.1 Eliminar o adaptar `SimulacionTab.benchListsRowLayout.test.ts` (guarda de CSS para
      `.benchListsRow`, clase que se elimina en la tarea 5.1) — ya no aplica; documentar en el
      commit/PR por qué se retira.
- [ ] 6.2 Revisar `SimulacionTab.onFieldPanel.test.tsx` / `PartidoEnDirectoTab.onFieldPanel.test.tsx`
      para que sigan siendo válidos con la nueva estructura (el listado ya no depende de
      `prepareMode` para su visibilidad, solo para su contenido).

## 7. Verificación final

- [ ] 7.1 `npm run test` (bloqueante, sin truncar) — toda la suite en verde, sin tests saltados;
      confirmar que ningún fallo toca los archivos de esta feature (los flakies preexistentes en
      otras áreas no cuentan como regresión).
- [ ] 7.2 `npm run build` (bloqueante) — build de producción sin errores de TypeScript estricto.
- [ ] 7.3 Revisar manualmente ambas pestañas con un banquillo largo (>8 jugadores) en escritorio,
      tablet y móvil para confirmar que el banquillo compacto cabe cómodamente y que el bloque
      informativo se ve completo con scroll de página si hace falta.
- [ ] 7.4 `openspec validate coach-simulation-bench-tablet-layout --strict` sin errores.
