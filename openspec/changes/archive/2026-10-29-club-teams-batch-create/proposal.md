## Why

Un club con varias categorías (Cadete A, B, C…) crea sus equipos de uno en uno desde `/coach/clubs/:id/teams/new`, repitiendo categoría, liga y foto cada vez. Se aprueba un rediseño del formulario (artboards escritorio y móvil) que permite crear varios equipos de una categoría de una sola vez, eligiendo letras de la A a la Z y omitiendo los que ya existen.

## What Changes

- **Frontend (Coach, `Front/`)**: rediseño de `CreateTeam` con selector «Un equipo / Varios equipos».
  - «Un equipo»: mismo comportamiento que hoy (nombre, categoría, liga, foto).
  - «Varios equipos»: categoría + liga opcional, cuadrícula de letras A–Z con atajos A–D, A–H, A–Z y Limpiar; las letras de equipos ya existentes en esa categoría y club aparecen bloqueadas; al cambiar de categoría se reinicia la selección.
  - Resumen con contadores «se crearán» / «ya existen», lista de nombres («Cadete C») y botón «Crear N equipos» (desactivado con N = 0).
  - Escudo genérico como foto de los equipos creados en lote; se muestra cuando un equipo no tiene foto.
  - Responsive mobile-first, sin tablas; errores y resultado vía snackbar.
- **Backend (`Back/ExtractionApi/`)**: nueva feature `CreateTeamsBatch` (`POST api/catalog/teams/batch`) que crea un equipo por letra con nombre `{Categoría} {Letra}`, omitiendo en servidor los nombres ya existentes en el club y temporada, y devuelve los equipos creados y los omitidos. Sin foto: `UrlPhoto` queda vacío.
- **Versión**: web minor y API minor.

### Non-goals

Subir foto en lote, categorías distintas en una misma petición, renombrar o borrar en lote, nombres personalizados distintos de `{Categoría} {Letra}`.

## Capabilities

### New Capabilities
- `club-teams-batch-create`: creación en lote de equipos de una categoría desde el formulario de añadir equipo, con deduplicación en cliente y servidor.

## Impact

- Front: `Front/src/apps/coach/pages/clubTeams/create/CreateTeam.tsx` (+ CSS Module), nuevos componentes de selector de letras y resumen, `teamService.ts` (`createTeamsBatch`), escudo genérico (recurso estático) usado donde se pinta la foto de equipo sin `urlPhoto` (`ClubTeamCard`), tests en `__tests__/`.
- Back: nueva feature `Features/Coaches/Teams/Commands/CreateTeamsBatch.cs` (comando + validador + handler + endpoint, invalida caché `TeamConstants.CachePrefix`, `IRequireFeaturePermission` `ClubTeams`/`ReadWrite`) y tests en `RFFM.Api.Tests`.
- Versiones: `Front/package.json`, `Back/ExtractionApi/Directory.Build.props`.
