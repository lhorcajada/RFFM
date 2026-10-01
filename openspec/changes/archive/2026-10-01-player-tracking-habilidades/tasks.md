## 1. Backend (~1h)

- [x] Red: dominio:
  - `ForGameModel` con habilidades (sin duplicados);
  - `Update` sustituye o mantiene;
  - actitud con habilidades → `DomainException`.
- [x] Red: validators de creación y edición: vocabulario, máximo 5, duplicados y actitud con habilidades.
- [x] Red: handlers (Postgres): crear devuelve las habilidades; editar las sustituye; el listado las incluye.
- [x] Green: dominio, comandos, validators, DTO y `ErrorCodes.HabilidadesNotAllowedForAttitude` (design.md D1, D2).
- [x] Subir la versión minor de la API.
- **Verify**: `dotnet test` (PowerShell, salida dentro del repo).

## 2. Frontend (~1,5h)

- [x] Red: `HabilidadesPicker.test.tsx`: seleccionar y quitar; con 5, el resto deshabilitado.
- [x] Red: `SessionObservationForm.test.tsx` (habilidades en la request de subprincipio y sin picker en actitud), `ObservationForm.test.tsx` (habilidades en la request) y `PlayerObservationCard.test.tsx` (chips y edición de habilidades; actitud sin picker).
- [x] Green: servicio, `HabilidadesPicker`, `RatingBlock`, formularios y tarjeta (D3).
- [x] Subir la versión minor de la web.
- **Verify**: `npm run build` + `npx vitest run --maxWorkers=2`.

## 3. Cierre

- [x] `openspec validate player-tracking-habilidades --strict`.
- [x] Comprobación visual a ~360 px.
- [x] Commits tras confirmación del usuario.
