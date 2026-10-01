## 1. Backend (~1,5h)

- [x] Red: `PlayerModelObservationTests`:
  - `ForAttitude` guarda la clave, el tipo y la sesión, y deja el subprincipio en `null`;
  - clave desconocida → `ArgumentException`;
  - catálogo con los 6 rasgos en orden.
- [x] Red: `CreatePlayerObservationValidatorTests`:
  - actitud válida;
  - clave desconocida;
  - actitud con subprincipio;
  - modelo sin subprincipio;
  - modelo con actitud;
  - tipo desconocido.
- [x] Red: `PlayerObservationHandlerTests`: alta de actitud con sesión → `attitudeLabel`; el listado mezcla los dos tipos.
- [x] Green: `ObservationKind.Attitude`, `AttitudeTraits`, `ForAttitude`, comando, validator, handler y DTO (design.md D1, D2).
- [x] Subir la versión minor de la API.
- **Verify**: `dotnet test` (PowerShell, salida dentro del repo).

## 2. Frontend (~1,5h)

- [x] Red: `SessionObservationForm.test.tsx`:
  - sección «Actitud» con los 6 rasgos en orden;
  - request de actitud;
  - las de subprincipio llevan `kind: "GameModel"`;
  - comentario obligatorio si no asistió;
  - sesión sin targets permite valorar actitud y guardar.
- [x] Red: `PlayerObservationCard.test.tsx` (tarjeta de actitud) y `PlayerTrackingPanel.test.tsx` (la confirmación nombra el rasgo).
- [x] Green: servicio (tipos + `ATTITUDE_TRAITS`), `SessionObservationForm`, `PlayerObservationCard` y `PlayerTrackingPanel` (D3).
- [x] Subir la versión minor de la web.
- **Verify**: `npm run build` + `npm run test`.

## 3. Cierre

- [x] `openspec validate player-tracking-attitude --strict`.
- [x] Comprobación visual a ~360 px.
- [x] Commits tras confirmación del usuario.
