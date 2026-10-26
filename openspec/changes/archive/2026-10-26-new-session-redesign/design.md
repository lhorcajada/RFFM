## Context

`NewSessionPage` renderiza `useSessionForm` en una columna y delega los bloques en `SessionBlockEditor`.

## Decisions

- **D1 · Secciones**: `<section aria-labelledby>` con título por tarjeta; los campos MUI y sus etiquetas
  actuales («Nombre», «Fecha …», «Evento deportivo …») no cambian, así que los tests existentes siguen válidos.
- **D2 · Disposición**: `.layout` en flex-wrap; columna principal (Datos + Bloques) y `aside` (Cuándo y dónde +
  Resumen) que baja debajo en ≤ 900 px. Sin tablas ni columnas fijas.
- **D3 · Resumen**: calculado en la página desde `form.blocks` (bloques y suma de `exercises.length`).
- **D4 · Bloques**: insignia con el número de orden, mensaje «Este bloque aún no tiene ejercicios.» cuando no
  hay ejercicios, y botones de acción con alto mínimo 44 px. Lógica de drag y callbacks intactos.

## Risks

- Tests existentes buscan etiquetas y botones por nombre: se conservan.
