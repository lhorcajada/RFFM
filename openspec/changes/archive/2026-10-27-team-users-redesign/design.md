## Context

`TeamUsers.tsx` pinta una lista de `Card` MUI con `Chip` de colores por rol y estilos fijos en `TeamUsers.module.css`.

## Decisions

- **D1 · Filtro**: estado local `filter: "all" | "pending" | "approved"`; los contadores salen de `users`. Botones en `role="group"` con `aria-pressed`; la lista filtrada reutiliza el `ul role="list" aria-label="usuarios del equipo"`.
- **D2 · Tarjetas**: se mantiene `li` con alias en `h3`; el rol es un chip neutro (solo «Creador» se destaca) y el estado lleva icono además del color.
- **D3 · Sin lógica nueva**: `canDelete`, `canToggleApproval`, `toggleApproval` y `confirmDelete` no cambian.
- **D4 · Estilo**: CSS Modules con `--rffm-dash-accent`, `--rffm-dash-card-bg`, `--rffm-dash-card-text` y `color-mix`; solo los verdes/rojos de estado son valores fijos.
- **D5 · Responsive**: tarjetas en `flex-wrap` (`flex: 1 1 340px`), botones ≥44px, sin tablas.

## Risks

- Los tests existentes buscan `Aprobado` y `Pendiente de aprobación` por texto; los botones de filtro no deben coincidir (se usan «Pendientes»/«Aprobados»).
