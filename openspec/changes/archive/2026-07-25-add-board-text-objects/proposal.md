# Add Board Text Objects

## Why

En el editor de ejercicios (`coach/trainings/new-exercise`) el tablero táctico soporta chapas, espacios, material y líneas, pero no hay forma de anotar el ejercicio con texto libre (nombres de zonas, instrucciones, numeración de secuencias, etc.). El coach necesita poder colocar objetos de texto sobre el campo con control tipográfico básico.

## What Changes

- **Frontend** (todo el trabajo real):
  - Nueva pestaña **"Texto"** en la barra inferior de herramientas de `NewExercisePage.tsx`, junto a Chapas/Espacios/Material/Líneas, mutuamente excluyente con ellas (mismo patrón de toggles).
  - Nuevo strip `TextsStrip.tsx` con los controles del estilo activo: **fuente** (lista fija de familias), **tamaño**, **tipo** (negrita/cursiva) y **color** (swatches como las líneas).
  - Con la pestaña activa, un clic en el campo crea un objeto de texto en ese punto con el estilo activo; doble clic sobre un texto colocado permite **editar su contenido** en línea.
  - Los textos colocados se comportan como el resto de objetos: **mover** (drag), **redimensionar** (escala), **rotar**, **bloquear**, **duplicar** y **borrar** (controles de `PlacedObjectControls` y arrastre fuera del campo). También se puede cambiar el estilo de un texto ya colocado seleccionándolo.
  - Nuevo tipo `PlacedText` en `types.ts`; `TacticalBoardSnapshot` añade `placedTexts` (opcional, retro-compatible con boards guardados sin textos). Se serializa/deserializa en `useTacticalBoard.ts`, con lo que el texto **se guarda y recarga con el ejercicio**.

- **Backend**: **sin cambios**. Verificado: `BoardStateJson` es una columna PostgreSQL `text` sin validación de esquema en `TaskTrainingBase`, y viaja opaco por `CreateExercise`/`UpdateExercise`/`GetExercises`/`GetExerciseById`. El nuevo objeto entra dentro del JSON existente.

## Non-Goals

- No se añade validación de esquema del board en backend ni migraciones.
- No se soportan fuentes personalizadas/subidas; solo una lista fija de familias web-safe.
- No hay alineación de párrafo, subrayado ni texto multilínea rico (el texto puede contener saltos de línea simples, sin más formato interno).
- No se exporta el texto a la imagen del ejercicio más allá de lo que ya haga el render actual del tablero.

## Impact

- **Front**: `apps/coach/pages/trainings/new/{types.ts, constants.ts, NewExercisePage.tsx, NewExercisePage.module.css, hooks/useTacticalBoard.ts, components/TacticalField.tsx, components/TextsStrip.tsx (nuevo)}` + tests (`useTacticalBoard.test.tsx`, `TacticalField.test.tsx`, `TextsStrip.test.tsx` nuevo).
- **Back**: ninguno.
