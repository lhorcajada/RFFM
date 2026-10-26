## Why

La pestaña «Lesionados» del Coach muestra todas las lesiones, activas e históricas, mezcladas en una
rejilla de tarjetas pequeñas con acciones solo de icono. No da una lectura rápida de cuántos jugadores
están de baja, obliga a recorrer el historial para ver los activos y las acciones táctiles son
pequeñas (< 44 px).

## What Changes

- **Solo frontend (`Front/`)**, pestaña «Lesionados» (`InjuredPlayersList`); sin cambios de API ni de
  backend. Las pestañas «Protocolo» y «Documentos» no cambian.
  - Cabecera de contadores: «Activas» (lesiones sin alta) y «Altas este mes» (alta en el mes actual).
  - Filtros en chips con altura táctil ≥ 44 px: «Activas» (por defecto) e «Historial» (lesiones con alta).
  - Tarjeta nueva: dorsal en círculo, nombre, demarcación/alias, tipo de lesión, chip de estado
    (Activa/Alta), fechas de inicio y alta, «Rec.: …» y botones de texto «Actualizar» y «Dar de alta».
  - Barra de % de recuperación solo cuando `estimatedRecovery` se interpreta de forma fiable
    («2 semanas», «3-4 semanas», «10 días», «1-2 meses»); en otro caso se omite.
  - Estado vacío por filtro (`EmptyState`) y loading existentes.
  - Responsive mobile-first: 1 columna en móvil y rejilla de 3 columnas en escritorio. Sin tablas.
- Se mantienen: carga con `getTeamInjuries`, `InjuryDialog`, diálogo de alta de lesión,
  `ConfirmDialog` de alta, resaltado por `?highlight=` y permisos `isCoach`.
- **Versión**: web minor (1.69.0 → 1.70.0).

## Capabilities

### New Capabilities
- `coach-injured-redesign`: resumen, filtros y tarjetas de la pestaña «Lesionados» del Coach.

## Impact

- `Front/src/apps/coach/pages/injured/components/InjuredPlayersList.tsx` (+ `.module.css`).
- Nuevo `Front/src/apps/coach/pages/injured/injuryRecovery.ts` (lógica pura) con test.
- Tests: `InjuredPlayersList.test.tsx` (actualizado y ampliado).
- `Front/package.json` (versión).
- **Fuera de alcance**: estado «Duda», pestaña «En recuperación», cambios de backend/API.
