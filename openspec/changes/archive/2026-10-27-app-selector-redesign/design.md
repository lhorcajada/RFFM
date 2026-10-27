## Context

`AppSelector` renderiza dos `AppCard` (Federación y Mi equipo) dentro de `ContentLayout`; el `onClick` de cada una decide la navegación según roles.

## Decisions

- **D1 · AppCard**: añade la prop `access: string`. La tarjeta sigue siendo un único `CardActionArea` (nombre accesible = todo su contenido); el texto «Entrar» es un `<span aria-hidden>` con flecha, no un segundo botón. `getByText("Federación")` y `getByText("Mi equipo")` siguen encontrando un único elemento.
- **D2 · Cabecera**: `ContentLayout` conserva el título «Selecciona tu aplicación»; se añade encima la etiqueta «FutbolBase» y debajo la línea «Elige desde dónde quieres trabajar. Puedes cambiar de aplicación en cualquier momento.».
- **D3 · Estilo**: icono dentro de recuadro redondeado; pie con línea de acceso y «Entrar» separados por un borde superior. Solo tokens/colores ya usados en `AppSelector.module.css`; sin `styled()` ni estilos inline.
- **D4 · Móvil (≤ 768 px)**: la tarjeta pasa a fila (icono, título + descripción, flecha) y se oculta la línea de acceso y el botón «Entrar»; la rejilla sigue en una columna.

## Risks

- Tests existentes buscan por texto «Federación» / «Mi equipo»: se conservan como único elemento.

## Addendum

- **D5 · Cabecera sin indicadores**: `AppHeader` y `BaseLayout` aceptan `hideIndicators` / `hideHeaderIndicators`; `AppSelector` lo activa y se ocultan la hucha del equipo y las notificaciones. Test: `AppHeader.hideIndicators.test.tsx`.
