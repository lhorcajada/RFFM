## Context

`Settings.tsx` pinta un `<nav>` con `div` clicables; en móvil se vuelve una fila con `overflow-x: auto`.

## Decisions

- **D1 · Móvil**: `useMediaQuery("(max-width:600px)")`. En móvil se renderiza un botón (`aria-haspopup`, `aria-expanded`) con la sección actual; al pulsarlo se muestra una lista `role="menu"` con `role="menuitem"` por sección, que se cierra al elegir. No se renderiza la lista de escritorio.
- **D2 · Escritorio**: `<nav aria-label="Secciones de ajustes">` con un `button` por sección (`aria-current="page"` en la activa), sustituyendo a los `div` clicables (accesibilidad por teclado).
- **D3 · Datos**: las secciones salen de un array `{ key, label, description, icon }` filtrado por rol; sin lógica nueva de permisos.
- **D4 · Cabecera**: el panel muestra título y descripción de la sección activa.
- **D5 · Estilo**: CSS Modules y tokens `--rffm-dash-*` existentes; sin tablas ni scroll horizontal.

## Risks

- Tests existentes buscan por «Panel …» (mocks de los paneles), que no cambian.
