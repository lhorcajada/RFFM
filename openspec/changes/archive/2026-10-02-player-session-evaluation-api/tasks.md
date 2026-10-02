## 1. Dominio (~1h)

- [x] Refactor: mover `SubprincipioSnapshot` a su propio archivo (sin cambios de comportamiento; los tests siguen en verde).
- [x] Red: `PlayerSessionEvaluationTests`:
  - crear con instantáneas;
  - lista vacía, duplicados y sesión futura → `DomainException` con su código;
  - comentario de más de 500 caracteres → `ArgumentException`;
  - `ReplaceEvaluations` sustituye y actualiza `UpdatedAt`.
- [x] Green: `SessionSnapshot`, `SubprincipioEvaluationInput`, `PlayerSessionEvaluation`, `SubprincipioEvaluation` y los `ErrorCodes` (design.md D1).
- **Verify**: `dotnet test --filter PlayerSessionEvaluationTests`.

## 2. Persistencia (~0,5h)

- [x] Configuraciones EF + `DbSet` (D2).
- [x] Migración `AddPlayerSessionEvaluations` (`--configuration Release`).
- [x] Red → Green (Postgres): borrar la sesión deja `TrainingSessionId = null` con la instantánea.

## 3. Endpoints (~1,5h)

- [x] Red: validator del `PUT`.
- [x] Red: handlers (Postgres):
  - crear;
  - volver a guardar sustituye;
  - subprincipio fuera de la sesión;
  - sesión de otro equipo;
  - sesión futura;
  - `GET` y su 404;
  - `DELETE` y su 404.
- [x] Red: autorización (403 para los roles que no son Coach en los tres endpoints).
- [x] Green: `SaveSessionEvaluation.cs`, `GetSessionEvaluation.cs` y `DeleteSessionEvaluation.cs` (D3).
- [x] Subir la versión minor de la API.
- **Verify**: `dotnet test` (PowerShell, salida dentro del repo).

## 4. Cierre

- [x] `openspec validate player-session-evaluation-api --strict`.
- [x] Commits tras confirmación del usuario: migración (`4d71ac81`) y código (`38163ae1`).
