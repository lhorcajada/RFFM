# Tasks — Add Board Text Objects

Frontend-only (backend verificado sin cambios). TDD estricto: tests primero en cada bloque.

## 1. Tipos, constantes y estado del hook (≈2h)

- [ ] Tests primero (Red) en `hooks/__tests__/useTacticalBoard.test.tsx`:
  - crear texto en un punto con el estilo activo (`createTextAtPoint`)
  - `updatePlacedText` cambia contenido y estilo
  - `removePlacedText`, `duplicatePlacedText` (offset +2), `toggleLockPlacedText`, `rotatePlacedText`
  - texto bloqueado no se mueve ni se borra por drag-out
  - round-trip: `serializeBoardStateJson` incluye `placedTexts` y `loadBoardStateJson` los restaura
  - retro-compatibilidad: snapshot sin `placedTexts` carga con `[]`
  - `handleToggleTexts` apaga las otras pestañas y viceversa
- [ ] `types.ts`: `PlacedText`, `TextStyle`, `placedTexts?` en `TacticalBoardSnapshot` (design.md §1).
- [ ] `constants.ts`: `TEXT_FONT_OPTIONS`, `TEXT_SIZE_OPTIONS`, `DEFAULT_TEXT_STYLE` (design.md §2).
- [ ] `useTacticalBoard.ts`: estado, operaciones, drag, serialización (design.md §3).
- Verificar: `npm run test -- useTacticalBoard` (verde) y `npm run build`.

## 2. TextsStrip (≈1h30)

- [ ] Tests primero (Red): `components/__tests__/TextsStrip.test.tsx` — render de fuente/tamaño/B/I/color; los cambios actualizan `activeTextStyle`; con texto seleccionado aplican a ese texto vía `updatePlacedText`.
- [ ] Crear `components/TextsStrip.tsx` (design.md §4) + estilos en `NewExercisePage.module.css`.
- Verificar: `npm run test -- TextsStrip && npm run build`.

## 3. Render en TacticalField + página (≈2h)

- [ ] Tests primero (Red) en `components/__tests__/TacticalField.test.tsx`:
  - textos colocados se renderizan con fontFamily/size/weight/style/color correctos
  - clic selecciona (muestra `PlacedObjectControls`), doble clic entra en edición
  - blur/Enter confirma el nuevo contenido; texto vacío al confirmar elimina el objeto; Escape cancela
- [ ] `TacticalField.tsx`: render, selección, edición inline, resize handles (design.md §5).
- [ ] `NewExercisePage.tsx`: botón "Texto" (`TextFieldsIcon`) + montaje condicional de `TextsStrip` (design.md §6).
- [ ] CSS: `placedText`, `placedTextSelected`, strip de texto en `NewExercisePage.module.css`.
- Verificar: `npm run test -- TacticalField && npm run build`.

## 4. Verificación final (≈30min)

- [ ] `npm run test` completo — 100% pass, sin tests saltados.
- [ ] `npm run build` — sin errores TypeScript.
- [ ] Backend: `dotnet test` en verde sin tocar código (confirma que el contrato no cambió). **Avisar antes si la API está corriendo localmente.**
- [ ] Prueba manual: crear ejercicio con textos (distintas fuentes/tamaños/colores, negrita/cursiva), guardar, recargar/editar el ejercicio y verificar que los textos vuelven idénticos; mover/rotar/duplicar/bloquear/borrar; abrir un ejercicio antiguo sin textos y comprobar que carga sin errores.
