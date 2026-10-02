## Context

- `TrainingSession`: `TeamId`, `Name`, `Date?` y `Targets` (`TrainingSessionSubSubPrincipio`).
  - El subprincipio de un target se resuelve como `ssp.SubprincipioId ?? ssp.Zona.SubprincipioId`
    (`SessionTargetDetailLookup` en `GetSession.cs`).
  - El equipo es por temporada (`Team.SeasonId`).
- Ya existen y se reutilizan:
  - `ObservationAssessment` (SmartEnum);
  - `SubprincipioSnapshot` (record dentro de `PlayerModelObservation.cs`; se mueve a su propio archivo
    sin cambios);
  - `PlayerTrackingGuards.EnsurePlayerInTeamAsync`;
  - `PlayerTrackingConstants.AllowedRoles = "Coach"`.
- Patrón de colección hija con reemplazo completo: `TrainingSession.ReplaceTargets`,
  `SessionBlock.ReplaceExercises`.
- `DomainException(título, mensaje, código)` → `400` ProblemDetails; `NotFoundException` → `404`.

## Decisions

### D1 · Dominio (`Domain/Entities/TeamPlayers/`)

```csharp
public record SessionSnapshot(string Id, string Name, DateOnly Date);
public record SubprincipioEvaluationInput(SubprincipioSnapshot Subprincipio, ObservationAssessment Assessment, string? Comment);

public class PlayerSessionEvaluation : BaseEntity
{
    public string TeamId { get; private set; }
    public string TeamPlayerId { get; private set; }
    public string? TrainingSessionId { get; private set; }   // FK SetNull
    public string SessionName { get; private set; }           // instantánea
    public DateOnly SessionDate { get; private set; }          // instantánea
    public string CreatedByUserId { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }
    public IReadOnlyCollection<SubprincipioEvaluation> Subprincipios => _subprincipios;   // List<> privada

    public static PlayerSessionEvaluation Create(string teamId, string teamPlayerId, SessionSnapshot session,
        IEnumerable<SubprincipioEvaluationInput> evaluations, string createdByUserId, DateOnly today);
    public void ReplaceEvaluations(IEnumerable<SubprincipioEvaluationInput> evaluations, DateOnly today);
}

public class SubprincipioEvaluation : BaseEntity
{
    public string PlayerSessionEvaluationId { get; private set; }
    public string? SubprincipioId { get; private set; }       // FK SetNull
    public string MomentName { get; private set; }
    public string PrincipleLabel { get; private set; }
    public string SubprincipioLabel { get; private set; }
    public ObservationAssessment Assessment { get; private set; }
    public string? Comment { get; private set; }               // recortado, en blanco → null, ≤ 500
}
```

Invariantes (`DomainException`, código entre paréntesis):
- al menos una valoración (`SessionEvaluationEmpty`);
- sin subprincipios repetidos (`SessionEvaluationDuplicatedSubprincipio`);
- no se puede valorar una sesión con fecha posterior a hoy (`SessionNotHeldYet`);
- comentario de 500 caracteres como máximo (`ArgumentException`, igual que en la 1a; el validator lo
  filtra antes).

`ReplaceEvaluations` sustituye la lista completa y actualiza `UpdatedAt`.

### D2 · Persistencia

- Tablas `app.PlayerSessionEvaluations` y `app.PlayerSessionSubprincipioEvaluations`.
- Índice único `(TeamPlayerId, TrainingSessionId)`: un seguimiento por jugador y sesión. Postgres admite
  varios `NULL`, así que los seguimientos de sesiones ya borradas no chocan.
- FKs:
  - `TeamPlayer` y `Team` → Cascade;
  - `TrainingSession` → **SetNull** (el seguimiento sobrevive con la instantánea);
  - hijo → padre: Cascade;
  - `Subprincipio` → SetNull.
- Colección mapeada con su campo privado (`HasMany(e => e.Subprincipios).WithOne()...` +
  `Navigation(...).UsePropertyAccessMode(PropertyAccessMode.Field)`).
- La migración `AddPlayerSessionEvaluations` va en un commit propio, antes del código.

### D3 · API — `Features/Coaches/PlayerTracking/`

Ruta base: `/api/teams/{teamId}/players/{teamPlayerId}/session-evaluations/{sessionId}`. Todos los
endpoints llevan `Roles = Coach` (`PlayerTrackingConstants.AllowedRoles`), `IRequireFeaturePermission`
(`GameModel`: `Read` en `GET`, `ReadWrite` en el resto) e `IRequireTeamMembership`.

- **`SaveSessionEvaluation.cs`** — `PUT` → `200` con el DTO (crea o sustituye).
  - Body: `{ evaluations: [{ subprincipioId, assessment, comment? }] }`.
  - Validator: al menos una valoración, ids no vacíos y sin repetir, `assessment` válido y comentario
    de 500 caracteres como máximo.
  - Handler:
    1. El jugador debe ser del equipo; si no, `404`.
    2. Carga la sesión del equipo. Si no existe o no tiene fecha, `404` `SessionNotFound`.
    3. Calcula los subprincipios de la sesión desde sus targets. Si alguno de los pedidos no está,
       `DomainException` `SubprincipioNotInSession` (`400`).
    4. Instantáneas de etiquetas en una única consulta (como `CreatePlayerObservation`).
    5. Busca el seguimiento existente (jugador + sesión): si existe, `ReplaceEvaluations`; si no,
       `Create`.
    6. `SaveChangesAsync`.
- **`GetSessionEvaluation.cs`** — `GET` → `200` DTO, o `404` `SessionEvaluationNotFound`.
- **`DeleteSessionEvaluation.cs`** — `DELETE` → `204`, o `404` `SessionEvaluationNotFound`.

```csharp
public record SessionEvaluationDto(string Id, string? TrainingSessionId, string SessionName, DateOnly SessionDate,
    IReadOnlyList<SubprincipioEvaluationDto> Subprincipios, DateTime CreatedAt, DateTime UpdatedAt);
public record SubprincipioEvaluationDto(string? SubprincipioId, string MomentName, string PrincipleLabel,
    string SubprincipioLabel, string Assessment, string? Comment);
```

## Tests

- Dominio:
  - crear con instantáneas;
  - lista vacía, duplicados y sesión futura → `DomainException` con su código;
  - `ReplaceEvaluations` sustituye y actualiza `UpdatedAt`.
- Validator del `PUT`.
- Handlers (Postgres):
  - crear, y volver a guardar sustituye (sigue habiendo un único seguimiento);
  - subprincipio que no está en la sesión → `DomainException`;
  - sesión de otro equipo → `NotFoundException`;
  - sesión futura → `DomainException`;
  - `GET` devuelve el detalle y da `404` si no hay seguimiento;
  - `DELETE` borra y da `404` si no hay;
  - borrar la sesión deja el seguimiento con `TrainingSessionId = null` y la instantánea.
- Autorización: los roles que no son Coach reciben `403` en los tres endpoints.
