# Implement — Add Board Text Objects

Guion técnico para `openspec-implementer`. Frontend-only, en `Front/src/apps/coach/pages/trainings/new/`. TDD estricto: en cada paso, escribir/ampliar los tests indicados ANTES de la implementación, verificar que fallan (Red), implementar lo mínimo (Green) y refactorizar.

Convenciones: TypeScript strict (sin `any`), CSS Modules en `NewExercisePage.module.css` (los strips y objetos del tablero ya viven ahí), MUI v5, patrones existentes del propio directorio como referencia (materiales y líneas son los análogos más cercanos).

## Paso 1 — Tipos y constantes

1. `types.ts`: añadir al final:

```ts
export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  color: string;
}

export interface PlacedText extends TextStyle {
  id: string;
  text: string;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  locked: boolean;
}
```

   y en `TacticalBoardSnapshot` añadir `placedTexts?: PlacedText[];` (opcional: retro-compatibilidad).

2. `constants.ts`: añadir:

```ts
export const TEXT_FONT_OPTIONS = [
  { key: "Arial, sans-serif", label: "Arial" },
  { key: "'Roboto', sans-serif", label: "Roboto" },
  { key: "Georgia, serif", label: "Georgia" },
  { key: "'Courier New', monospace", label: "Courier" },
  { key: "'Comic Sans MS', cursive", label: "Comic" },
];

export const TEXT_SIZE_OPTIONS = [12, 14, 16, 20, 24, 32, 40];

export const DEFAULT_TEXT_STYLE = {
  fontFamily: TEXT_FONT_OPTIONS[0].key,
  fontSize: 16,
  bold: false,
  italic: false,
  color: "#ffffff",
} satisfies TextStyle;
```

   (importar `TextStyle` desde `./types`).

## Paso 2 — Hook `useTacticalBoard.ts` (TDD)

**Red**: en `hooks/__tests__/useTacticalBoard.test.tsx` añadir un `describe("texts", ...)` siguiendo el estilo de los tests existentes del hook (renderHook + ref de pitch mockeada con `getBoundingClientRect`). Casos mínimos:

- `createTextAtPoint(clientX, clientY)` añade un `PlacedText` con el estilo activo, `text: "Texto"`, `rotation: 0`, `scaleX/scaleY: 1`, `locked: false`, y deja `editingTextId` con su id.
- `updatePlacedText(id, { text: "Presión alta" })` actualiza el contenido; `updatePlacedText(id, { bold: true, color: "#ff0000" })` actualiza estilo.
- `removePlacedText`, `duplicatePlacedText` (nuevo id, x/y +2), `toggleLockPlacedText`, `rotatePlacedText` (+15 % 360).
- `setActiveTextStyle` cambia el estilo de los textos futuros, no de los existentes.
- Round-trip: colocar texto → `serializeBoardStateJson()` → `loadBoardStateJson(json)` restaura `placedTexts` idéntico.
- `loadBoardStateJson(JSON.stringify({ placedChapas: {}, chapaPetoById: {}, placedSpaces: [], placedMaterials: [], placedLines: [] }))` deja `placedTexts` como `[]`.
- `handleToggleTexts()` activa `showTexts` y apaga `showChapas/showSpaces/showMaterials/showLines`; `handleToggleLines()` con textos activos apaga `showTexts`.

**Green**: en `useTacticalBoard.ts`:

- Estado nuevo junto al de líneas: `showTexts`, `placedTexts`, `activeTextStyle` (init `DEFAULT_TEXT_STYLE`), `editingTextId`, `draggingTextId`.
- `handleToggleTexts` clonando el patrón de `handleToggleLines` (al activar, apagar el resto + `setActiveLineKind(null)` + `setDrawingState(null)`). Añadir `setShowTexts(false)` a los otros cuatro toggles.
- `createTextAtPoint(clientX, clientY)`: `getRawDropPosition` → clamp x/y a `[0, 100]` → push `PlacedText` (id vía `crypto.randomUUID()` con fallback como los demás) → `setEditingTextId(id)`.
- `updatePlacedText(textId: string, patch: Partial<PlacedText>)`: map + spread.
- `movePlacedText(textId, clientX, clientY)`: como `movePlacedMaterial` pero clamp simple a `[0, 100]` y respetando `locked`.
- `removePlacedText`, `duplicatePlacedText` (patrón `duplicatePlacedMaterial`), `toggleLockPlacedText`, `rotatePlacedText` (patrón material/espacio).
- Resize: `textResizeSession` + `handleTextResizeStart` + `useEffect` clonando el bloque de `materialResizeSession` (escala `[0.3, 4]`, base de tamaño: usar `fontSize` como proporción — basta con escalar `scaleX/scaleY` uniformemente con el delta dominante).
- Drag: `handlePlacedTextDragStart` (`text/text-instance-id`), `handlePlacedTextDragEnd` (fuera del campo → `removePlacedText` si no `locked`), rama nueva en `handleFieldDrop` ANTES de la de chapas: si hay `text/text-instance-id` → `movePlacedText`.
- `handleTextFieldClick(e: React.MouseEvent<HTMLDivElement>)`: si `!showTexts || editingTextId` → return; `createTextAtPoint(e.clientX, e.clientY)`.
- `clearBoardState`: `setPlacedTexts([])`. `loadBoardSnapshot`: `setPlacedTexts(snapshot.placedTexts ?? [])`. `serializeBoardStateJson`: incluir `placedTexts`.
- Exportar todo en el objeto de retorno (bloque `// Texts`), incluidos `activeTextStyle`, `setActiveTextStyle`, `editingTextId`, `setEditingTextId`, `updatePlacedText`.

Verificar: `npm run test -- useTacticalBoard` → verde. `npm run build` → sin errores.

## Paso 3 — `TextsStrip.tsx` (TDD)

**Red**: crear `components/__tests__/TextsStrip.test.tsx` (patrón de los tests de componentes existentes: render con un `board` real de `renderHook(useTacticalBoard)` o mock tipado de `TacticalBoardState`). Casos:

- Renderiza select de fuente, select de tamaño, botones B/I (con `aria-pressed`), swatches de color y hint.
- Cambiar fuente/tamaño/B/I/color sin texto seleccionado → `setActiveTextStyle`/estilo activo actualizado.
- Con `selectedTextId` (prop) apuntando a un texto colocado → los controles muestran el estilo de ese texto y los cambios llaman a `updatePlacedText(selectedTextId, …)`.

**Green**: crear `components/TextsStrip.tsx`:

```tsx
interface TextsStripProps {
  board: TacticalBoardState;
  selectedTextId?: string | null;
}
```

- Deriva `currentStyle`: estilo del texto seleccionado si existe, si no `board.activeTextStyle`.
- `applyStyle(patch: Partial<TextStyle>)`: si hay seleccionado → `board.updatePlacedText(id, patch)`; además siempre `board.setActiveTextStyle({ ...board.activeTextStyle, ...patch })`.
- Layout como `LinesStrip` (contenedor `styles.linesStrip` o clase nueva `textsStrip` equivalente): `Select` MUI `size="small"` para fuente (opciones con `style={{ fontFamily: opt.key }}`) y tamaño, dos `<button type="button" aria-pressed>` para B (`fontWeight: 700`) e I (cursiva), swatches reutilizando `styles.lineColorSwatch`, y `Typography` de hint: "Haz clic en el campo para colocar el texto. Doble clic sobre un texto para editarlo."
- Estilos nuevos en `NewExercisePage.module.css`: `.textsStrip`, `.textStyleBtn`, `.textStyleBtnActive` siguiendo la paleta de los strips existentes.

Verificar: `npm run test -- TextsStrip` → verde.

## Paso 4 — `TacticalField.tsx` + `NewExercisePage.tsx` (TDD)

**Red**: en `components/__tests__/TacticalField.test.tsx` añadir casos:

- Con `placedTexts` en el board, se renderiza cada texto con su contenido y estilos inline (`font-family`, `font-size`, `font-weight`, `font-style`, `color`).
- Clic sobre un texto lo selecciona (aparecen los controles de objeto); doble clic muestra el editor (`textbox`) con el contenido actual.
- Escribir y `Enter`/blur → `updatePlacedText` con el nuevo contenido; confirmar con contenido vacío → el texto desaparece; `Escape` → conserva el contenido original.
- Con `showTexts` activo, clic en el campo (no sobre un objeto) crea un texto.

**Green**:

- `TacticalField.tsx`:
  - Estado local `activeTextId` (deseleccionar con el mismo mecanismo que `activeMaterialId` al clicar fuera).
  - En el `<div>` del campo: si `board.showTexts`, `onClick={board.handleTextFieldClick}` (solo cuando el clic no viene de un objeto — los objetos hacen `stopPropagation`).
  - Render de `board.placedTexts`: contenedor absoluto `left/top` en %, `transform: translate(-50%, -50%) rotate(Xdeg)`; estilos inline `fontFamily`, `fontSize: t.fontSize * t.scaleX`, `fontWeight: t.bold ? 700 : 400`, `fontStyle: t.italic ? "italic" : "normal"`, `color`; clase `styles.placedText` (+ `styles.placedTextSelected` si activo); `draggable={!t.locked && editingTextId !== t.id}` con los handlers del hook; `onClick` → seleccionar + `stopPropagation`; `onDoubleClick` → `board.setEditingTextId(t.id)`.
  - Si `editingTextId === t.id`: render de `<textarea autoFocus>` con el mismo estilo inline; `Enter` (sin Shift) y blur confirman (`updatePlacedText`; si `trim() === ""` → `removePlacedText`), `Escape` cancela; en todos los casos `setEditingTextId(null)`.
  - Si seleccionado y no editando: `PlacedObjectControls` con `onDuplicate/onRotate/onToggleLock/onRemove` + handles de resize (`handleTextResizeStart`), siguiendo exactamente el bloque de materiales.
  - Pasar `selectedTextId={activeTextId}` hacia `TextsStrip` requiere levantarlo: `NewExercisePage` es quien monta el strip → mover `activeTextId` al hook NO; en su lugar, el hook ya expone `editingTextId`; para la selección usar también estado en el hook: si resulta más simple, añadir `selectedTextId`/`setSelectedTextId` al hook en el Paso 2 y usarlo tanto en `TacticalField` como en `TextsStrip` (decisión permitida; mantener los tests alineados).
- `NewExercisePage.tsx`: import `TextFieldsIcon from "@mui/icons-material/TextFields"`; botón "Texto" tras "Lineas" con `variant={board.showTexts ? "contained" : "outlined"}` y `onClick={board.handleToggleTexts}`; `{board.showTexts && <TextsStrip board={board} selectedTextId={board.selectedTextId} />}`.
- CSS `NewExercisePage.module.css`: `.placedText { position:absolute; cursor:move; user-select:none; white-space:pre; text-shadow: 0 1px 2px rgba(0,0,0,.6); }`, `.placedTextSelected { outline:1px dashed rgba(255,255,255,.8); outline-offset:2px; }`, `.placedTextEditor` para el textarea (fondo transparente, mismo font, sin borde nativo).

Verificar: `npm run test -- TacticalField` → verde. `npm run build` → sin errores.

## Paso 5 — Verificación final

1. `npm run test` completo → 100% pass, sin skips.
2. `npm run build` → sin errores.
3. `dotnet test` (backend, sin cambios de código) → verde. **Avisar al usuario antes por si la API está corriendo localmente.**
4. Informar resumen: archivos tocados, tests añadidos, y recordatorio de prueba manual (crear/editar/guardar/recargar ejercicio con textos; abrir ejercicio antiguo).
