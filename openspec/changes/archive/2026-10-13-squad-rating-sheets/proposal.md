## Why

Hoy el entrenador valora **jugador a jugador** (`NewRatingPage`): entra en un jugador, recorre
sus 24 características (25 si es portero), lee los 10 niveles de cada una y guarda. Para valorar
a toda la plantilla repite esa lectura con cada jugador, y decide cada nivel casi en abstracto:
la comparativa con los compañeros solo es informativa.

Dándole la vuelta —una hoja por característica donde se colocan los jugadores en cada nivel— se
lee cada característica una sola vez y se valora por comparación directa, que es más rápido y da
notas más coherentes entre jugadores.

## What Changes

- **Nueva página «Valorar plantilla»** (`/coach/squad/rating-sheet`) con **dos hojas**:
  **Jugadores** y **Porteros**. Se abre desde un botón nuevo en la pestaña «Valoraciones» de
  Plantilla (solo Coach y Administrator).
- En cada hoja se elige una característica y se ven sus **10 niveles** con los jugadores
  colocados como chips, más una bandeja **«Sin colocar»**.
- **Colocar = tocar**: se tocan uno o varios chips y después el nivel (o «Sin colocar» para
  quitarlos). Sin arrastrar, para que funcione igual en móvil.
- La hoja parte de la **última valoración** de cada jugador. La lista de características muestra
  el progreso («14/18»).
- En la hoja de Jugadores, **filtro por línea** (Todos, Defensas, Medios, Delanteros); cada chip
  lleva el color de su línea.
- **Guardar** crea, en una sola operación atómica, una valoración nueva **solo para los
  jugadores que han cambiado y tienen todas las características respondidas**, todas con la misma
  fecha (editable, por defecto hoy). Las notas de cada jugador se conservan de su última
  valoración. Los jugadores con cambios pero incompletos se avisan y no se guardan.
- **Nuevo endpoint** `POST /api/catalog/team/{teamId}/ratings` (lote de valoraciones).
- La pantalla por jugador **se mantiene** sin cambios (fichajes, retoques y notas).
- **Versiones**: API minor (`1.25.0`), Web minor (`1.47.0`). Mobile no cambia.

## Capabilities

### New Capabilities
- `squad-rating-sheets`: valoración de la plantilla por característica, con hojas separadas para
  jugadores de campo y porteros y guardado por lote.

## Impact

- `Back/ExtractionApi`: `Features/Coaches/Players/Commands/CreateTeamRatingsBatch.cs`
  (`ICommand` + validador + handler), `ErrorCodes` nuevos. Sin migración: reutiliza
  `TeamPlayerRating.CreateConceptual`.
- `Front`: `pages/squad/rating/RatingSheetPage.tsx` (+ hook, utilidades y componentes),
  `playerRatingService.ts` (`createTeamRatings`), `SquadRatings.tsx` (botón), `routes.tsx`,
  `rating/positionCategory.ts` (extraído de `NewRatingPage`/`SquadRatings`).
- **Fuera de alcance**: arrastrar y soltar; editar notas desde la hoja; guardar borradores en
  servidor; validar en backend el catálogo de características (sigue viviendo en el front);
  Mobile; cambios en historial, evolución, ranking o PDF.
