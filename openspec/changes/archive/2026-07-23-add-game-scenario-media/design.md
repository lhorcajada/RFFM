## Architecture Decisions

### 1. Dominio — `GameScenario` gana `MediaUrl`/`MediaType`

```csharp
// Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/GameModels/GameScenario.cs
public string? MediaUrl { get; private set; }
public string? MediaType { get; private set; } // "image" | "video"

public void UpdateMedia(string url, string mediaType)
{
    if (string.IsNullOrWhiteSpace(url)) throw new ArgumentException("Media url cannot be empty.", nameof(url));
    if (mediaType != "image" && mediaType != "video") throw new ArgumentException("Invalid media type.", nameof(mediaType));
    MediaUrl = url;
    MediaType = mediaType;
}

public void ClearMedia()
{
    MediaUrl = null;
    MediaType = null;
}
```

Siguiendo el patrón inmutable con setters privados ya usado en la clase (`UpdateName`, `UpdateContext`).

### 2. EF Configuration + migración

`GameScenarioConfiguration.cs` gana:

```csharp
builder.Property(x => x.MediaUrl).HasMaxLength(500);
builder.Property(x => x.MediaType).HasMaxLength(10);
```

Migración vía `cd Back/ExtractionApi && .\manage-migrations.ps1` (nombre sugerido: `AddGameScenarioMedia`), sobre `AppDbContext` (schema `app`, mismo contexto que el resto de `GameModels`).

### 3. Endpoint de subida — `UploadScenarioMedia.cs` (nuevo, calca `UploadExerciseMedia.cs`)

```csharp
// POST /api/game-models/scenarios/{id}/media
namespace RFFM.Api.Features.Coaches.GameModels.Commands
{
    public class UploadScenarioMedia : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/game-models/scenarios/{id}/media",
                    async (string id, IFormFile file, HttpContext httpContext, IMediator mediator, CancellationToken ct) =>
                    {
                        var userId = httpContext.User.Claims
                            .FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;
                        if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

                        var result = await mediator.Send(new UploadScenarioMediaCommand(id, file, userId), ct);
                        return Results.Ok(result);
                    })
                .WithName(nameof(UploadScenarioMedia))
                .WithTags(GameModelConstants.Tag)
                .RequireAuthorization()
                .DisableAntiforgery()
                .Produces<UploadScenarioMediaResult>()
                .Produces(StatusCodes.Status401Unauthorized)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest);
        }
    }

    public record UploadScenarioMediaCommand(string ScenarioId, IFormFile File, string UserId)
        : IRequest<UploadScenarioMediaResult>, IRequireFeaturePermission
    {
        public string FeatureRoute => CoachFeatureRoutes.GameModel;
        public string RequiredPermission => "ReadWrite";
    }

    public record UploadScenarioMediaResult(string Url, string MediaType);

    public class UploadScenarioMediaHandler : IRequestHandler<UploadScenarioMediaCommand, UploadScenarioMediaResult>
    {
        private const string Bucket = "game-scenarios";
        private readonly AppDbContext _db;
        private readonly IStorageService _storage;

        public UploadScenarioMediaHandler(AppDbContext db, IStorageService storage) { _db = db; _storage = storage; }

        public async ValueTask<UploadScenarioMediaResult> Handle(UploadScenarioMediaCommand request, CancellationToken ct = default)
        {
            var scenario = await _db.GameScenarios
                .Include(s => s.GameModel)
                .FirstOrDefaultAsync(s => s.Id == request.ScenarioId, ct);
            if (scenario is null)
                throw new DomainException("Modelo de Juego", "Escenario no encontrado.", ErrorCodes.ScenarioNotFound);

            var hasAccess = await _db.UserClubs
                .Join(_db.Teams, uc => uc.ClubId, t => t.ClubId, (uc, t) => new { uc, t })
                .AnyAsync(x => x.uc.ApplicationUserId == request.UserId && x.t.Id == scenario.GameModel.TeamId, ct);
            if (!hasAccess)
                throw new DomainException("Modelo de Juego", "No tienes acceso a este escenario.", ErrorCodes.GameModelAccessDenied);

            var mediaType = request.File.ContentType.StartsWith("video/") ? "video" : "image";
            var ext = Path.GetExtension(request.File.FileName);
            var fileName = $"{Guid.NewGuid()}{ext}";

            var url = await _storage.UploadAsync(Bucket, fileName, request.File, ct);

            if (!string.IsNullOrEmpty(scenario.MediaUrl))
                await _storage.DeleteAsync(Bucket, Path.GetFileName(scenario.MediaUrl), ct);

            scenario.UpdateMedia(url, mediaType);
            await _db.SaveChangesAsync(ct);

            return new UploadScenarioMediaResult(url, mediaType);
        }
    }

    public class UploadScenarioMediaValidator : AbstractValidator<UploadScenarioMediaCommand>
    {
        private static readonly HashSet<string> AllowedContentTypes = new()
        {
            "image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"
        };
        private const long MaxBytes = 20 * 1024 * 1024; // 20 MB

        public UploadScenarioMediaValidator()
        {
            RuleFor(x => x.ScenarioId).NotEmpty();
            RuleFor(x => x.File)
                .NotNull()
                .Must(f => f.Length > 0).WithMessage("El archivo no puede estar vacío.")
                .Must(f => f.Length <= MaxBytes).WithMessage("El archivo supera el límite de 20 MB.")
                .Must(f => AllowedContentTypes.Contains(f.ContentType)).WithMessage("Formato no permitido.");
        }
    }
}
```

Nota: `GameScenario` no tiene FK directa a `Club`/`Team` — el chequeo de acceso reutiliza el mismo patrón `UserClubs ⋈ Teams` que `GetGameModel.cs`/`UpdateGameModel.cs` (vía `scenario.GameModel.TeamId`), por eso se incluye `GameModel` en el `Include`.

### 4. Endpoint de borrado — `DeleteScenarioMedia.cs` (nuevo)

Calca `DeletePlayerPhoto.cs`: `DELETE /api/game-models/scenarios/{id}/media`, resuelve el `GameScenario`, valida el mismo acceso, llama `_storage.DeleteAsync(Bucket, Path.GetFileName(scenario.MediaUrl), ct)` si había media, y `scenario.ClearMedia()` + `SaveChangesAsync`. Devuelve `204 NoContent`. Si `MediaUrl` ya es `null`, no falla (idempotente) — simplemente no hace nada y devuelve `204`.

### 5. `GetGameModel.cs` — exponer media

`ScenarioResponse` gana dos campos al final (posición nueva, no rompe nada porque es un `record` posicional consumido por el frontend por nombre de propiedad JSON, no por posición):

```csharp
public record ScenarioResponse(
    string Id, int GameMomentId, string GameMomentName, int GameZoneId, string GameZoneName,
    int Order, string Name, string Context,
    IEnumerable<TacticalPrincipleDto> TacticalPrinciples,
    IEnumerable<SubPrincipleResponse> SubPrinciples,
    string? MediaUrl,
    string? MediaType);
```

El `Select` del handler añade `s.MediaUrl, s.MediaType` al final de la construcción de cada `ScenarioResponse`.

### 6. `ErrorCodes.cs` — nuevo código

```csharp
// Game Models (Features/Coaches/GameModels)
public const string ScenarioNotFound = "ScenarioNotFound";
```
(junto a `GameModelNotFound`/`GameModelAccessDenied` ya existentes).

### 7. Frontend — tipos y servicio

`types/gameModel.ts`:
```ts
export interface Scenario {
  id: number;
  apiId?: string;
  order: number;
  name: string;
  context: string;
  tacticalPrinciples: TacticalPrinciple[];
  subPrinciples: SubPrinciple[];
  mediaUrl?: string | null;
  mediaType?: "image" | "video" | null;
}
```

`gameModelService.ts`:
- `ApiScenario` gana `mediaUrl: string | null; mediaType: "image" | "video" | null;` y `mapApiToGameModel` los propaga al `Scenario` mapeado.
- `mapModelToRequest` **no** los incluye (la media no viaja por el `PUT` masivo, igual que `apiId`/mastery no se recalculan ahí).
- Dos métodos nuevos:
```ts
async uploadScenarioMedia(scenarioApiId: string, file: File): Promise<{ url: string; mediaType: "image" | "video" }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await client.post(`/api/game-models/scenarios/${scenarioApiId}/media`, formData);
  return res.data;
},

async deleteScenarioMedia(scenarioApiId: string): Promise<void> {
  await client.delete(`/api/game-models/scenarios/${scenarioApiId}/media`);
},
```

### 8. Frontend — validación de vídeo client-side (resolución/duración)

Antes de subir un vídeo, se valida leyendo metadata con un `<video>` oculto (patrón nuevo, no existe hoy porque `ExerciseFormPanel` no valida resolución/duración):

```ts
function validateVideoConstraints(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      if (video.duration > 10) return resolve("El vídeo no puede durar más de 10 segundos.");
      if (video.videoWidth > 1920 || video.videoHeight > 1080) return resolve("El vídeo no puede superar 1920x1080.");
      resolve(null);
    };
    video.onerror = () => resolve("No se pudo leer el vídeo.");
    video.src = URL.createObjectURL(file);
  });
}
```

Se ejecuta en el handler de selección de archivo del bloque de media (ver punto 9); si devuelve un mensaje, se muestra como error y no se sube. Tamaño máximo (20 MB, imagen y vídeo) se valida sincrónicamente por `file.size` antes de esto.

### 9. Frontend — UI en `ScenarioFormAccordion.tsx` (edición)

En `ScenarioDetailForm` (líneas 296-334 actuales), justo después del `Autocomplete` de principios tácticos y antes de "Subprincipios", se añade un bloque de media que reutiliza el patrón visual de `ExerciseFormPanel.tsx` (input oculto + preview `<img>`/`<video>` + botón quitar), pero con subida/borrado **inmediatos** (no en `pendingFile` diferido), porque el escenario en edición ya tiene `apiId` salvo que sea nuevo y no se haya guardado el modelo todavía:

```tsx
{scenario.apiId ? (
  <ScenarioMediaField
    scenarioApiId={scenario.apiId}
    mediaUrl={scenario.mediaUrl}
    mediaType={scenario.mediaType}
    onChange={(mediaUrl, mediaType) =>
      dispatch({ type: "UPD_SCENARIO", mi, zi, si, changes: { mediaUrl, mediaType } })
    }
  />
) : (
  <Typography className={styles.mediaHint} color="text.secondary">
    Guarda el modelo de juego para poder añadir una foto o vídeo a este escenario.
  </Typography>
)}
```

`ScenarioMediaField` (nuevo componente co-ubicado, `ScenarioFormAccordion.tsx` mismo directorio o archivo propio `ScenarioMediaField.tsx` con su `.module.css`) encapsula: input oculto (`accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"`), validación tamaño/vídeo (punto 8), llamada a `gameModelService.uploadScenarioMedia`/`deleteScenarioMedia`, estado de "subiendo…", y preview condicional `<video controls>` vs `<img>` según `mediaType`.

### 10. Frontend — cambios en `GameModelDraftContext.tsx`

`UPD_SCENARIO` cambia su tipo de `changes` para incluir los campos de media:

```ts
| {
    type: "UPD_SCENARIO";
    mi: number; zi: number; si: number;
    changes: Partial<Pick<Scenario, "name" | "context" | "tacticalPrinciples" | "mediaUrl" | "mediaType">>;
  }
```

El reducer (`case "UPD_SCENARIO"`) no cambia de lógica (ya hace spread de `action.changes`).

### 11. Frontend — `ScenarioAccordion.tsx` (lectura)

En `ScenarioDetailView` (línea ~137), tras el `Typography` de `context` y antes de los principios tácticos, se añade un bloque de solo-lectura:

```tsx
{scenario.mediaUrl && (
  <Box className={styles.mediaViewer}>
    {scenario.mediaType === "video" ? (
      <video src={scenario.mediaUrl} controls className={styles.mediaViewerContent} />
    ) : (
      <img src={scenario.mediaUrl} alt={`Situación: ${scenario.name}`} className={styles.mediaViewerContent} />
    )}
  </Box>
)}
```

`.module.css` (`ScenarioAccordion.module.css`): `.mediaViewerContent { max-width: 100%; height: auto; border-radius: 8px; }` — sin límite fijo de altura para que se vea nítido en pantallas grandes, con `max-width: 100%` para que no rompa el layout en móvil (criterio de aceptación "se vea muy definida en todos los dispositivos").

## Files

**Backend** (nuevos):
- `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/GameModels/Commands/UploadScenarioMedia.cs`
- `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/GameModels/Commands/DeleteScenarioMedia.cs`
- Migración EF (`AddGameScenarioMedia`)

**Backend** (modificados):
- `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/GameModels/GameScenario.cs`
- `Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/Configuration/Aggregates/GameModels/GameScenarioConfiguration.cs`
- `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/GameModels/Queries/GetGameModel.cs`
- `Back/ExtractionApi/src/RFFM.Api/Domain/ErrorCodes.cs`

**Frontend** (nuevos):
- `Front/src/apps/coach/pages/game-model/components/ScenarioMediaField.tsx` (+ `.module.css`)

**Frontend** (modificados):
- `Front/src/apps/coach/types/gameModel.ts`
- `Front/src/apps/coach/services/gameModelService.ts`
- `Front/src/apps/coach/context/GameModelDraftContext.tsx`
- `Front/src/apps/coach/pages/game-model/components/ScenarioFormAccordion.tsx`
- `Front/src/apps/coach/pages/game-model/components/ScenarioAccordion.tsx` (+ `.module.css`)

## Tests (TDD — Red → Green → Refactor)

**Backend** (`RFFM.Api.Tests`, xUnit + Moq, `PostgresContainerFixture` real igual que el resto de tests de `GameModels`):
- `UploadScenarioMediaHandlerTests`: sube imagen → `MediaUrl`/`MediaType="image"` persistidos; sube vídeo → `MediaType="video"`; reemplaza media existente → borra el archivo anterior (`IStorageService.DeleteAsync` mock verificado); usuario sin acceso al club/equipo → `DomainException` (`GameModelAccessDenied`); escenario inexistente → `DomainException` (`ScenarioNotFound`).
- `UploadScenarioMediaValidatorTests`: `ContentType` no permitido → inválido; archivo > 20 MB → inválido; archivo vacío → inválido.
- `DeleteScenarioMediaHandlerTests`: con media existente → limpia campos y llama `DeleteAsync`; sin media (`MediaUrl` null) → no falla, no llama `DeleteAsync`.
- `GetGameModelHandlerTests` (extender los existentes si hay, o nuevo): `ScenarioResponse.MediaUrl`/`MediaType` reflejan lo persistido.

**Frontend** (Vitest + Testing Library):
- `ScenarioMediaField.test.tsx`: sin media → muestra botón "Subir imagen/vídeo"; selecciona imagen válida → llama `gameModelService.uploadScenarioMedia` y muestra preview `<img>`; selecciona vídeo que excede 10s/1920x1080 (mockeando `HTMLVideoElement` metadata) → muestra error y no llama al servicio; con media existente → muestra preview y botón "Quitar" que llama `deleteScenarioMedia`.
- `ScenarioFormAccordion.test.tsx` (extender): escenario sin `apiId` → muestra el aviso "Guarda el modelo de juego primero" y no el campo de media.
- `ScenarioAccordion.test.tsx` (extender): `scenario.mediaUrl` con `mediaType: "video"` renderiza `<video>`; con `"image"` renderiza `<img>`; sin `mediaUrl` no renderiza el bloque.

Coverage objetivo: handlers backend ≥80%, componentes frontend ≥75% (según CLAUDE.md).
