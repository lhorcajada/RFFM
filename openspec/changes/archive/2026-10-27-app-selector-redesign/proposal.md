## Why

El selector de aplicación («Selecciona tu aplicación») muestra dos tarjetas con icono, título y descripción, pero no indica quién puede entrar en cada una ni tiene una llamada a la acción clara. El rediseño de referencia está en `.design/app-selector` (escritorio y móvil).

## What Changes

- **Solo frontend (`Front/`)**, página `AppSelector` y `AppCard`; sin cambios de API ni backend.
  - **Cabecera**: etiqueta «FutbolBase», título y línea de ayuda.
  - **Tarjetas**: icono en recuadro, título, descripción, línea de acceso («Acceso: administración y federación», «Entrenadores, jugadores y familias») y botón visible «Entrar».
  - **Móvil**: tarjetas en fila horizontal (icono, título, descripción, flecha), ≥ 44 px, sin scroll.
- Se mantiene: lógica de roles, redirecciones, diálogos y reglas de entrada de `useTeamAppEntry`.
- **Versión**: web minor (1.79.0 → 1.80.0).

## Capabilities

### New Capabilities
- `app-selector-redesign`: cabecera con ayuda y tarjetas con línea de acceso y acción «Entrar».

## Impact

- `Front/src/shared/pages/AppSelector/AppSelector.tsx` + `.module.css`, `components/AppCard.tsx`.
- Tests: `AppSelector.redesign.test.tsx`.
- `Front/package.json` (versión).
- **Fuera de alcance**: backend, diálogos, hook `useTeamAppEntry`.
