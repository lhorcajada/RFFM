## Context

- Diseño completo y contexto del modelo de juego: `docs/game-model/Seguimiento-Modelo-Juego-Diseno.md`.
- Jerarquía del modelo de juego: `Subprincipio` → `GamePrinciple` (`Numero`, `Titulo`, `GameModelId`,
  `GameMomentId`) → `GameMoment.Name`, y `GameModel.TeamId`.
  - `UpdateGameModel` borra los Subprincipios que desaparecen del modelo.
- Patrones del repo que se reutilizan:
  - `IFeatureModule` + Mediator (`IRequest`/`IQueryApp`) + validator anidado;
  - el handler llama a `SaveChangesAsync` (como `CreateTeamNote`);
  - `NotFoundException(message, ErrorCodes.X)` se convierte en ProblemDetails 404;
  - `SmartEnum` convertido automáticamente por `ConfigureSmartEnum()`;
  - `JsonColumns.ConfigureStringList` para `List<string>` jsonb;
  - `ICurrentUserService.UserId`.
- Permisos:
  - `CoachFeatureRoutes.GameModel` está en «Blocked for Player»;
  - `IRequireTeamMembership` exige pertenencia al equipo.
  
  Ambos se aplican como pipeline behaviors, ya testeados (`FeaturePermissionBehaviorTests`,
  `TeamMembershipBehaviorTests`).

## Decisions

### D1 · Dominio

```csharp
public sealed class ObservationKind : SmartEnum<ObservationKind>
{   public static readonly ObservationKind GameModel = new(nameof(GameModel), 1); }      // Attitude(2) llega en 1d

public sealed class ObservationAssessment : SmartEnum<ObservationAssessment>
{   Achieved = 1, Partial = 2, NotAchieved = 3 }

public record SubprincipioSnapshot(string Id, string MomentName, string PrincipleLabel, string SubprincipioLabel);

public class PlayerModelObservation : BaseEntity
{
    public static class Rules { public const int CommentMaxLength = 500; public const int LabelMaxLength = 300; }

    public string TeamPlayerId { get; private set; }
    public string TeamId { get; private set; }
    public DateOnly Date { get; private set; }
    public ObservationKind Kind { get; private set; }
    public string? SubprincipioId { get; private set; }
    public string? MomentName { get; private set; }
    public string? PrincipleLabel { get; private set; }
    public string? SubprincipioLabel { get; private set; }
    public string? AttitudeKey { get; private set; }          // columna para 1d, siempre null en 1a
    public List<string> Habilidades { get; private set; }     // columna para 1e, siempre vacía en 1a
    public string? TrainingSessionId { get; private set; }    // columna para Fase 2, siempre null en 1a
    public ObservationAssessment Assessment { get; private set; }
    public string? Comment { get; private set; }
    public string CreatedByUserId { get; private set; }
    public DateTime CreatedAt { get; private set; }

    public static PlayerModelObservation ForGameModel(string teamPlayerId, string teamId, DateOnly date,
        SubprincipioSnapshot subprincipio, ObservationAssessment assessment, string? comment, string createdByUserId);
}
```

Invariantes del dominio (lanzan `ArgumentException`, como el resto de `Domain/`):
- ids obligatorios;
- instantánea completa;
- comentario de 500 caracteres como máximo, recortado, y en blanco pasa a `null`.

La fecha no futura es validación de entrada y va en el validator, no duplicada en el dominio.

Etiquetas:
- `PrincipleLabel = $"{p.Numero}. {p.Titulo}"`;
- `SubprincipioLabel = $"{sp.Numero} {sp.Titulo}"`;
- `MomentName = GameMoment.Name`.

### D2 · Persistencia

- Tabla `app.PlayerModelObservations`.
- Etiquetas con `HasMaxLength(300)`, comentario con `HasMaxLength(500)` y `Habilidades` con
  `JsonColumns.ConfigureStringList`.
- FKs:
  - `TeamPlayer` → Cascade;
  - `Subprincipio` → **SetNull**;
  - `TrainingSession` → SetNull;
  - `Team` → Cascade.
- Índices: `(TeamPlayerId, Date)` y `(TeamId, Date)`.
- La migración `AddPlayerModelObservations` va en un commit propio, separado del código
  (`git.md` §4.2).

### D3 · API — `Features/Coaches/PlayerTracking/`

`CreatePlayerObservation.cs`: `POST /api/teams/{teamId}/players/{teamPlayerId}/observations` → `201`
con `Location` y el `PlayerObservationDto`.

```csharp
public record Command : IRequest<PlayerObservationDto>, IRequireFeaturePermission, IRequireTeamMembership
{   TeamId, TeamPlayerId (ruta), DateOnly Date, string SubprincipioId, string Assessment, string? Comment;
    FeatureRoute => CoachFeatureRoutes.GameModel; RequiredPermission => "ReadWrite"; }
```

Validator:
- `Date` ≤ hoy (UTC);
- `SubprincipioId` no vacío;
- `Assessment` debe ser un nombre de `ObservationAssessment`;
- `Comment` de 500 caracteres como máximo.

Handler:
1. El jugador debe pertenecer al equipo; si no, 404 `TeamPlayerNotFound`.
2. Se carga el Subprincipio con su Principio, la Fase y el `GameModel.TeamId` en una única proyección.
   Si no existe o el `TeamId` no coincide, 404 `SubprincipioNotFound`.
3. `ForGameModel(... currentUser.UserId)` y `SaveChangesAsync`.

`GetPlayerObservations.cs`: `GET …/observations` → `PlayerObservationDto[]` ordenado por `Date` y
después `CreatedAt`, de más reciente a más antigua. `IQueryApp`, `GameModel` `Read`,
`IRequireTeamMembership` y 404 si el jugador no es del equipo.

```csharp
public record PlayerObservationDto(string Id, DateOnly Date, string Kind, string? SubprincipioId,
    string? MomentName, string? PrincipleLabel, string? SubprincipioLabel, string Assessment,
    string? Comment, DateTime CreatedAt);
```

Los nuevos códigos de error (`SubprincipioNotFound`) van en `Domain/ErrorCodes.cs`.

### D4 · Tests

- Unit: `PlayerModelObservationTests` (dominio) y `CreatePlayerObservationValidatorTests`.
- Integración con Postgres (`PostgresCollection`, seeding como `GetAdnCoverageHandlerTests`):
  - `CreatePlayerObservationHandlerTests`;
  - `GetPlayerObservationsHandlerTests`;
  - la prueba de SetNull al borrar el Subprincipio.
- Contrato de permisos: los dos requests implementan `IRequireFeaturePermission` con
  `CoachFeatureRoutes.GameModel` (`ReadWrite` / `Read`) e `IRequireTeamMembership`. El enforcement lo
  cubren los tests de los behaviors, que ya existen.
