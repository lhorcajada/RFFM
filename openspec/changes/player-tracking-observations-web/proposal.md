## Why

Entrega 1b del seguimiento del modelo de juego por jugador (hoja de ruta en
`docs/game-model/Seguimiento-Modelo-Juego-Diseno.md`). La API de observaciones ya existe (1a, API
1.1.0), pero el entrenador aún no puede usarla. Esta entrega es la **primera versión usable**: registrar
desde la ficha del jugador qué subprincipio del modelo de juego hace o no hace, y ver lo registrado.

## What Changes

- **Frontend (Coach, `Front/`)**:
  - Nueva pestaña **«Seguimiento»** al final de la ficha del jugador (`PlayerDetail.tsx`). Solo es
    visible con acceso a la feature `GameModel`; las demás pestañas no cambian de posición.
  - **Formulario** de alta:
    - subprincipio del modelo de juego de la temporada activa, agrupado por Fase › Principio;
    - fecha (hoy por defecto, no futura);
    - valoración con tres botones «Lo hace» / «A veces» / «No lo hace»;
    - comentario opcional (500 caracteres como máximo).
    
    Tras guardar se mantiene la fecha, para encadenar observaciones.
  - **Lista** de observaciones en tarjetas, la más reciente primero, con fecha, valoración, Fase ·
    Principio, subprincipio y comentario. Incluye estados de carga, error con «Reintentar» y vacío.
  - Si el equipo no tiene modelo de juego en la temporada activa, se muestra un aviso en lugar del
    formulario.
- **Versión**: web minor (`Front/package.json`).

## Capabilities

### New Capabilities
- `player-tracking-observations-web`: pestaña «Seguimiento» con el alta y el listado de observaciones.

## Impact

- `Front/src/apps/coach`:
  - `services/playerTrackingService.ts` (nuevo);
  - `pages/player/hooks/usePlayerObservations.ts` y `useSubprincipioOptions.ts` (nuevos);
  - `pages/player/components/tracking/` (nuevos: panel, formulario, lista + CSS Modules);
  - `pages/player/PlayerDetail.tsx`.
- Sin cambios de backend. Reutiliza `gameModelService.getByTeamIdAndSeason` y
  `seasonService.getActiveSeason`.
- **Fuera de alcance**:
  - editar y borrar (1c);
  - actitud (1d);
  - habilidades (1e);
  - filtro por periodo (1f);
  - sesión e informe (Fase 2).
