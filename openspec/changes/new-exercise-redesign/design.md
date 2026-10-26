## Context

`NewExercisePage` compone `TacticalField` + `ExerciseFormPanel` y una barra inferior de herramientas.
El estado del formulario vive en `useExerciseForm` (incluye `niveles`, `nivelesColumnas`, `dibujo`).

## Decisions

- **D1 · Título en la cabecera**: `TextField` en `NewExercisePage` ligado a `exerciseForm.form.name`
  (etiqueta accesible «Título»); se elimina del panel.
- **D2 · Carril de herramientas**: los cinco botones existentes pasan a una columna a la izquierda del
  campo dentro de `.workspace`, con icono + texto, ≥ 44 px y `aria-pressed`. Las tiras contextuales se
  quedan bajo el campo. En ≤ 980 px el carril pasa a fila horizontal desplazable bajo la cabecera.
- **D3 · Panel por tarjetas**: `ExerciseFormPanel` agrupa los campos en `<section>` con título de
  sección (CSS Modules, tokens del tema/`:root`, sin colores nuevos). Una columna; sin rejilla de dos.
- **D4 · Tipo segmentado**: tres `ToggleButton`/botones con `aria-pressed`, rol de grupo «Tipo»;
  llama a `setField("tipo", …)`. Subtipo sigue siendo un `Select`.
- **D5 · Niveles/Dibujo**: se retiran del render. `useExerciseForm` no cambia su contrato; al cargar un
  ejercicio con menos de 2 niveles se usan los niveles por defecto para que la validación 2–5 no
  bloquee un guardado sin UI para corregirla.

## Risks

- Ejercicios existentes con niveles: se preservan porque el estado no se toca.
- El test de la página busca el texto «Chapas»: se mantiene en el carril.
