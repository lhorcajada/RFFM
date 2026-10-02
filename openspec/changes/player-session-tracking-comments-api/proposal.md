## Why

Entrega R4a del rediseño «seguimiento por sesión». En la fase 1 la actitud se valoraba con 6 rasgos
fijos. El entrenador concluyó que no le sirven: no todas las sesiones trabajan lo mismo, y la evolución
de un rasgo no se lee en una lista. En su lugar quiere **comentarios evaluables propios**: un título y una
descripción (p. ej. «Implicación defensiva»), guardados en un **catálogo del equipo** para reutilizarlos
en otras sesiones y valorarlos en cada una con Lo hace / A veces / No lo hace. Si un mismo comentario se
reutiliza, el informe podrá mostrar su evolución.

## What Changes

- **Backend (`Back/ExtractionApi`)**:
  - Nueva entidad `TrackingComment`: catálogo por equipo, con título (único en el equipo sin distinguir
    mayúsculas, 100 caracteres como máximo) y descripción opcional (500 como máximo).
  - Endpoints del catálogo:
    - `GET /api/teams/{teamId}/tracking-comments`: ordenados por título;
    - `POST /api/teams/{teamId}/tracking-comments`: `201`, o `409` si el título ya existe.
  - El seguimiento de una sesión (`PlayerSessionEvaluation`) admite **valoraciones de comentarios**
    (`CommentEvaluation`): comentario del catálogo del equipo, valoración y nota opcional de esa sesión
    (500 como máximo). Se guarda el título del momento.
  - `PUT …/session-evaluations/{sessionId}` acepta `comments: [{ trackingCommentId, assessment, note? }]`.
    Basta con valorar al menos un subprincipio **o** un comentario.
  - `GET` del seguimiento devuelve los comentarios. El resumen de la lista de sesiones cuenta también
    sus valoraciones.
  - Migración `AddTrackingComments`.
  - Todo solo para el rol Coach, con el permiso `GameModel` y pertenencia al equipo.
  - **Versión**: API minor.

## Capabilities

### New Capabilities
- `player-session-tracking-comments`: catálogo de comentarios evaluables del equipo y su valoración en el
  seguimiento de una sesión.

## Impact

- `Back/ExtractionApi`:
  - `Domain/Entities/TeamPlayers/TrackingComment.cs` y `CommentEvaluation.cs` (nuevos);
  - `PlayerSessionEvaluation.cs`;
  - configuraciones EF, `AppDbContext` y la migración;
  - `Features/Coaches/PlayerTracking/GetTrackingComments.cs` y `CreateTrackingComment.cs` (nuevos);
  - `SaveSessionEvaluation.cs`, `GetSessionEvaluation.cs` y `GetPlayerSessionEvaluations.cs`;
  - `ErrorCodes`.
- **Fuera de alcance**:
  - la web (R4b);
  - editar o archivar comentarios del catálogo (R4c);
  - borrar la actitud de la fase 1 (R5).
