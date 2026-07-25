# Design — Add Board Text Objects

Frontend-only. Sigue los patrones existentes del tablero táctico (`useTacticalBoard.ts` es la única fuente de estado; strips como paneles de plantillas/estilo; `TacticalField.tsx` renderiza los objetos colocados; `PlacedObjectControls` para las acciones sobre el objeto seleccionado). CSS Modules co-locados (`NewExercisePage.module.css` ya concentra los estilos de strips y objetos del tablero).

## 1. Tipos — `new/types.ts`

```ts
export interface PlacedText {
  id: string;
  text: string;
  x: number;          // % sobre el campo, centro del objeto (como materiales)
  y: number;
  fontFamily: string; // clave de TEXT_FONT_OPTIONS
  fontSize: number;   // px base (se multiplica por scale al renderizar)
  bold: boolean;
  italic: boolean;
  color: string;      // hex
  rotation: number;
  scaleX: number;
  scaleY: number;
  locked: boolean;
}

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  color: string;
}
```

`TacticalBoardSnapshot` añade `placedTexts?: PlacedText[]` (opcional → boards antiguos deserializan sin error; `loadBoardSnapshot` hace `snapshot.placedTexts ?? []`).

## 2. Constantes — `new/constants.ts`

```ts
export const TEXT_FONT_OPTIONS = [
  { key: "Arial, sans-serif", label: "Arial" },
  { key: "'Roboto', sans-serif", label: "Roboto" },
  { key: "Georgia, serif", label: "Georgia" },
  { key: "'Courier New', monospace", label: "Courier" },
  { key: "'Comic Sans MS', cursive", label: "Comic" },
] as const;

export const TEXT_SIZE_OPTIONS = [12, 14, 16, 20, 24, 32, 40] as const;
export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: TEXT_FONT_OPTIONS[0].key,
  fontSize: 16,
  bold: false,
  italic: false,
  color: "#ffffff",
};
```

Colores: reutilizar `LINE_COLORS` (mismos swatches que líneas).

## 3. Estado y operaciones — `new/hooks/useTacticalBoard.ts`

Nuevo bloque análogo a materiales/líneas:

```ts
const [showTexts, setShowTexts] = useState(false);
const [placedTexts, setPlacedTexts] = useState<PlacedText[]>([]);
const [activeTextStyle, setActiveTextStyle] = useState<TextStyle>(DEFAULT_TEXT_STYLE);
const [editingTextId, setEditingTextId] = useState<string | null>(null);
```

- `handleToggleTexts`: mismo patrón de exclusión mutua que `handleToggleLines` (apaga las otras pestañas al activarse; todos los toggles existentes apagan también `showTexts`).
- `createTextAtPoint(clientX, clientY)`: usa `getRawDropPosition`; crea `PlacedText` con `activeTextStyle`, `text: "Texto"`, y entra directamente en modo edición (`setEditingTextId(id)`).
- `updatePlacedText(id, patch: Partial<PlacedText>)`: setter genérico (contenido y estilo de un texto ya colocado).
- `movePlacedText`, `removePlacedText`, `duplicatePlacedText`, `toggleLockPlacedText`, `rotatePlacedText` (+15°), `handleTextResizeStart` + sesión de resize: copiar el patrón de materiales (`materialResizeSession`), clamp de escala `[0.3, 4]`, sin clamp a área jugable estricto — como las líneas, el texto puede ir en las bandas (clamp solo a `[0, 100]`).
- Drag: `handlePlacedTextDragStart` escribe `text/text-instance-id` en dataTransfer; `handleFieldDrop` añade una rama que llama a `movePlacedText`; drag-end fuera del campo elimina (patrón `handlePlacedMaterialDragEnd`).
- Serialización: `serializeBoardStateJson` añade `placedTexts`; `clearBoardState` los vacía.

Click-para-crear: `TacticalField` ya tiene `handleDrawMouseDown` para líneas; para texto se añade en el hook `handleTextFieldClick(e)` (activo solo si `showTexts && !editingTextId`), llamado desde el `onClick` del campo cuando la pestaña Texto está activa y el clic no cae sobre un objeto existente.

## 4. Strip — `new/components/TextsStrip.tsx` (nuevo)

Patrón `LinesStrip.tsx`. Controla `activeTextStyle` — y si hay un texto seleccionado (`activeTextId` en `TacticalField` no; se usa `editingTextId`/último seleccionado vía prop `selectedTextId` levantado al hook), aplica los cambios también a ese texto con `updatePlacedText`:

- `Select` MUI compacto de fuente (`TEXT_FONT_OPTIONS`, cada opción renderizada con su propia `fontFamily`).
- `Select` de tamaño (`TEXT_SIZE_OPTIONS`).
- Toggles **B** / *I* (botones con `aria-pressed`).
- Swatches de color (`LINE_COLORS`, mismo estilo `lineColorSwatch`).
- Hint: "Haz clic en el campo para colocar el texto. Doble clic sobre un texto para editarlo."

Simplificación deliberada: el estilo activo vive en el hook (`activeTextStyle`); al seleccionar un texto colocado, el strip muestra el estilo de ese texto y los cambios se aplican a él; sin selección, definen el estilo de los próximos textos.

## 5. Render — `new/components/TacticalField.tsx`

- Estado local `activeTextId` (selección) como `activeMaterialId`.
- Render de `placedTexts`: `<div>` absoluto en `(x%, y%)` con `transform: translate(-50%, -50%) rotate(...)`, estilos inline de fuente (`fontFamily`, `fontSize: fontSize * scaleX`, `fontWeight`, `fontStyle`, `color`), `draggable` (si no `locked`), `onClick` selecciona, `onDoubleClick` → `setEditingTextId(id)`.
- Modo edición: reemplaza el `<div>` por un `<textarea>`/`<input>` autofocus con el mismo estilo; `onBlur`/`Enter` confirma (`updatePlacedText(id, { text })`; si queda vacío → `removePlacedText`), `Escape` cancela.
- Seleccionado y no editando: `PlacedObjectControls` con duplicar/rotar/bloquear/borrar + handles de resize (patrón material).
- Clase CSS `placedText` + `placedTextSelected` en `NewExercisePage.module.css` (borde punteado al seleccionar, `cursor: move`, `user-select: none` fuera de edición).

## 6. Página — `new/NewExercisePage.tsx`

- Botón "Texto" en `bottomToolBar` (icono `TextFieldsIcon` de `@mui/icons-material`), variante contained/outlined según `board.showTexts`.
- `{board.showTexts && <TextsStrip board={board} />}`.

## 7. Backend

Sin cambios. `BoardStateJson` (columna `text`, `TaskTrainingBase.cs:17`) es opaco para la API; los handlers `CreateExercise`/`UpdateExercise` lo persisten tal cual y `GetExercises`/`GetExerciseById` lo devuelven tal cual. No hay validador de contenido del JSON. La verificación se limita a los tests backend existentes en verde.

## 8. Tests (TDD)

- `hooks/__tests__/useTacticalBoard.test.tsx`: crear texto con estilo activo, actualizar contenido/estilo, mover, duplicar, bloquear (no mueve/borra), borrar, round-trip `serializeBoardStateJson` → `loadBoardStateJson` con `placedTexts`, retro-compatibilidad con snapshot sin `placedTexts`, exclusión mutua de `handleToggleTexts`.
- `components/__tests__/TextsStrip.test.tsx` (nuevo): render de controles, cambio de fuente/tamaño/negrita/cursiva/color actualiza el estilo activo; con texto seleccionado aplica a ese texto.
- `components/__tests__/TacticalField.test.tsx`: render de textos colocados con sus estilos, doble clic entra en edición, blur confirma, texto vacío se elimina.
