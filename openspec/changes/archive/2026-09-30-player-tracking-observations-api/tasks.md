## 1. Dominio (~1h)

- [x] Red: `PlayerModelObservationTests`:
  - `ForGameModel` guarda el jugador, el equipo, la fecha, la instantánea, la valoración, el autor y `Kind = GameModel`;
  - ids o instantánea vacíos → `ArgumentException`;
  - comentario de más de 500 caracteres → `ArgumentException`;
  - comentario en blanco → `null`.
- [x] Green: `ObservationKind`, `ObservationAssessment`, `SubprincipioSnapshot`, `PlayerModelObservation` (design.md D1).
- **Verify**: `dotnet test --filter PlayerModelObservationTests`.

## 2. Persistencia y migración (~1h)

- [x] `PlayerModelObservationEntityConfiguration` + `DbSet` en `AppDbContext` (D2).
- [x] Migración `AddPlayerModelObservations` (`manage-migrations.ps1` / `dotnet ef migrations add`).
- [x] Red → Green (Postgres): al borrar el Subprincipio, la observación queda con `SubprincipioId = null` y conserva las etiquetas.
- **Verify**: `dotnet build` + `dotnet test --filter PlayerModelObservationPersistence`.

## 3. Endpoints (~1,5h)

- [x] Red: `CreatePlayerObservationValidatorTests`: fecha futura, valoración desconocida, comentario de más de 500 caracteres y Subprincipio vacío.
- [x] Red: `CreatePlayerObservationHandlerTests` (Postgres):
  - happy path con etiquetas;
  - Subprincipio de otro equipo → `NotFoundException`;
  - Subprincipio inexistente → `NotFoundException`;
  - jugador de otro equipo → `NotFoundException`.
- [x] Red: `GetPlayerObservationsHandlerTests`: orden más reciente primero, solo el jugador pedido y jugador de otro equipo → `NotFoundException`.
- [x] Red: contrato de permisos (`GameModel` `ReadWrite`/`Read` + `IRequireTeamMembership`).
- [x] Green: `Features/Coaches/PlayerTracking/CreatePlayerObservation.cs`, `GetPlayerObservations.cs` y `ErrorCodes.SubprincipioNotFound` (D3).
- **Verify**: `dotnet build` + `dotnet test`.

## 4. Cierre

- [x] Subir la versión minor de la API en `Directory.Build.props`.
- [x] `openspec validate player-tracking-observations-api --strict`.
- [x] Commits tras confirmación del usuario (`40515646` migración, `987ef95f` código):
  - migración (`chore(mcp-api)`);
  - código (`feat(mcp-api)`).
