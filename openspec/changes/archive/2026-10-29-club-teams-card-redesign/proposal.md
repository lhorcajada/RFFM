## Why

La página «Equipos» del club (`/coach/clubs/:id/teams`) reutiliza `DashboardCard` pensada para el panel principal: tarjetas grandes, código y acciones apretadas en el pie y mucha variable CSS específica. Tras el rediseño del panel del club se aprueba un diseño propio (artboards escritorio y móvil) más compacto y legible.

## What Changes

- **Frontend (Coach, `Front/`)**: nueva tarjeta de equipo `ClubTeamCard` y rediseño de `ClubTeams`.
  - Cabecera con club y temporada, «Volver» y «Añadir equipo» con objetivos táctiles ≥44px.
  - Filtros Categoría y Liga y contador «N equipos».
  - Equipos agrupados por categoría (título de grupo con separador) en rejilla adaptable (`auto-fill, minmax(300px, 1fr)`); una columna en móvil.
  - Tarjeta: escudo/foto del equipo (o icono por defecto), nombre, «Liga · Categoría», código con botón de copiar, editar y eliminar.
- Se conserva el comportamiento actual: filtros, agrupado y orden, enlace de la tarjeta al dashboard del equipo (con `seasonId`), copiar código, editar, eliminar con confirmación, estados cargando/vacío/error.
- **Sin cambios de backend**.
- **Versión**: web minor.

### Non-goals

Nuevos datos por equipo (jugadores, próximo partido), paginación, reordenación.

## Capabilities

### New Capabilities
- `club-teams-card-redesign`: página de equipos del club con tarjetas compactas y responsive.

## Impact

- `Front/src/apps/coach/pages/clubTeams/ClubTeams.tsx` y `ClubTeams.module.css`; nuevo `components/ClubTeamCard.tsx` (+ CSS Module) y tests co-ubicados en `__tests__/`.
- Versión web: `Front/package.json`.
