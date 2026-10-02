## Context

- R1/R2:
  - `PlayerSessionEvaluation` con `Subprincipios` (`SubprincipioEvaluation`), `Create(...)` y
    `ReplaceEvaluations(...)`, que exigen al menos un subprincipio (`SessionEvaluationEmpty`);
  - `SaveSessionEvaluation` (`PUT`, con los DTO), `GetSessionEvaluation` y `GetPlayerSessionEvaluations`
    (resumen con conteos).
- Patrones: `DomainException` → `400`; `NotFoundException` → `404`; `ConflictException` → `409` (ver
  `Domain/ConflictException.cs`). `PlayerTrackingConstants.AllowedRoles = "Coach"`.

## Decisions

### D1 · Dominio

```csharp
public class TrackingComment : BaseEntity
{
    public static class Rules { public const int TitleMaxLength = 100; public const int DescriptionMaxLength = 500; }
    public string TeamId { get; private set; }
    public string Title { get; private set; }            // recortado, obligatorio
    public string? Description { get; private set; }     // recortada, en blanco → null
    public string CreatedByUserId { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public static TrackingComment Create(string teamId, string title, string? description, string createdByUserId);
}

public record CommentEvaluationInput(string TrackingCommentId, string Title, ObservationAssessment Assessment, string? Note);

public class CommentEvaluation : BaseEntity
{
    public string PlayerSessionEvaluationId { get; private set; }
    public string? TrackingCommentId { get; private set; }   // FK SetNull
    public string Title { get; private set; }                 // instantánea
    public ObservationAssessment Assessment { get; private set; }
    public string? Note { get; private set; }                 // ≤ 500
}
```

`PlayerSessionEvaluation`:
- `Create(..., IEnumerable<SubprincipioEvaluationInput> evaluations, string createdByUserId, DateOnly today, IEnumerable<CommentEvaluationInput>? comments = null)`.
- `ReplaceEvaluations(IEnumerable<SubprincipioEvaluationInput> evaluations, DateOnly today, IEnumerable<CommentEvaluationInput>? comments = null)`.
- `IReadOnlyCollection<CommentEvaluation> Comments`.
- Reglas:
  - al menos una valoración, de subprincipio **o** de comentario (`SessionEvaluationEmpty`);
  - sin comentarios repetidos (`SessionEvaluationDuplicatedComment`).

### D2 · Persistencia

- Tablas `app.TrackingComments` (índice `TeamId, Title`; FK `Team` Cascade) y
  `app.PlayerSessionCommentEvaluations` (FK al seguimiento Cascade; FK `TrackingComment` **SetNull**).
- `Comments` se mapea con su campo privado, como `Subprincipios`.
- La unicidad del título (sin distinguir mayúsculas) la comprueba el handler. No hay índice único en BD:
  la comparación es con `ToLower()`.
- La migración `AddTrackingComments` va en un commit propio.

### D3 · API — `Features/Coaches/PlayerTracking/`

- **`GetTrackingComments.cs`**: `GET /api/teams/{teamId}/tracking-comments` →
  `TrackingCommentDto(Id, Title, Description)[]`, ordenados por título. `GameModel` `Read`.
- **`CreateTrackingComment.cs`**: `POST` → `201` + DTO, con `Location`.
  - Validator: título obligatorio de 100 caracteres como máximo; descripción de 500 como máximo.
  - Si ya existe el título en el equipo (sin distinguir mayúsculas y recortado), `ConflictException`
    `TrackingCommentDuplicated`.
  - `GameModel` `ReadWrite`.
- **`SaveSessionEvaluation`**:
  - `Command.Comments: IReadOnlyList<CommentItem>` (`TrackingCommentId`, `Assessment`, `Note?`).
  - Validator:
    - `Evaluations` y `Comments` no pueden estar vacíos a la vez;
    - comentarios sin repetir, valoración válida y nota de 500 caracteres como máximo;
    - `Evaluations` puede venir vacío.
  - Handler:
    - carga los `TrackingComment` del equipo con esos ids; si falta alguno, `NotFoundException`
      `TrackingCommentNotFound`;
    - la validación de subprincipios solo se hace si hay alguno;
    - construye los `CommentEvaluationInput` con el título actual.
  - `SessionEvaluationDto` añade `Comments: CommentEvaluationDto(TrackingCommentId?, Title, Assessment, Note)[]`.
- **`GetSessionEvaluation`**: incluye `Comments`.
- **`GetPlayerSessionEvaluations`**: el resumen cuenta las valoraciones de subprincipios **y** de
  comentarios.

Todos los endpoints nuevos usan `Roles = Coach` e `IRequireTeamMembership`.

## Tests

- Dominio:
  - `TrackingComment.Create` (recorta; título vacío o demasiado largo → `ArgumentException`);
  - seguimiento solo con comentarios;
  - sin nada → `SessionEvaluationEmpty`;
  - comentario repetido → `SessionEvaluationDuplicatedComment`;
  - `ReplaceEvaluations` sustituye también los comentarios.
- Validators de `CreateTrackingComment` y `SaveSessionEvaluation` (vacío a la vez, repetidos, nota
  larga).
- Handlers (Postgres):
  - crear y listar el catálogo, ordenado y solo del equipo;
  - duplicado sin distinguir mayúsculas → `ConflictException`;
  - guardar un seguimiento con comentarios (título guardado), o solo con comentarios;
  - comentario de otro equipo → `NotFoundException`;
  - `GET` devuelve los comentarios;
  - la lista cuenta los comentarios en el resumen;
  - borrar el comentario del catálogo deja la valoración con `TrackingCommentId = null` y el título.
- Autorización: los roles que no son Coach reciben `403` en los dos endpoints nuevos.
