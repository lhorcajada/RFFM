## 1. Dominio (~0,5h)

- [x] Red: `TrackingCommentTests` y ampliación de `PlayerSessionEvaluationTests`:
  - solo comentarios;
  - vacío;
  - comentario repetido;
  - `ReplaceEvaluations` con comentarios.
- [x] Green: `TrackingComment`, `CommentEvaluation`, `CommentEvaluationInput`, cambios en `PlayerSessionEvaluation` y `ErrorCodes` (design.md D1).

## 2. Persistencia (~0,5h)

- [x] Configuraciones EF + `DbSet` (D2).
- [x] Red → Green (Postgres): borrar el comentario del catálogo deja la valoración con `TrackingCommentId = null`.
- [x] Migración `AddTrackingComments` (`--configuration Release`).

## 3. Endpoints (~1,5h)

- [x] Red: validators de `CreateTrackingComment` y de `SaveSessionEvaluation` (comentarios).
- [x] Red: handlers (Postgres):
  - catálogo (crear, listar, duplicado → 409, solo del equipo);
  - seguimiento con comentarios y solo comentarios;
  - comentario de otro equipo → 404;
  - `GET` con comentarios;
  - resumen de la lista.
- [x] Red: autorización de los dos endpoints nuevos y contrato de permisos.
- [x] Green: `GetTrackingComments.cs`, `CreateTrackingComment.cs`, `SaveSessionEvaluation`, `GetSessionEvaluation` y `GetPlayerSessionEvaluations` (D3).
- [x] Subir la versión minor de la API.
- **Verify**: `dotnet test` (PowerShell, salida dentro del repo).

## 4. Cierre

- [x] `openspec validate player-session-tracking-comments-api --strict`.
- [ ] Commits tras confirmación del usuario: migración (`chore(mcp-api)`) y código (`feat(mcp-api)`).
