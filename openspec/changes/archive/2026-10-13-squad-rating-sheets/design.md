## Context

- Una valoración es una fila `TeamPlayerRating` con sus `TeamPlayerRatingDetail`
  (característica, categoría, nivel 1–10, concepto). Cada guardado crea una fila nueva: el
  historial y la evolución se construyen con esas filas.
- `POST /api/catalog/teamplayer/{id}/ratings/conceptual` (`CreateConceptualRating`) es un handler
  inline de Minimal API, sin Mediator, sin validador y sin comprobar que el entrenador gestiona
  el equipo del jugador.
- El catálogo de características y sus niveles vive solo en el front
  (`pages/squad/rating/ratingConcepts.ts`: 24 de campo, 25 de portero). El backend no lo conoce.
- `NewRatingPage` ya carga `getPlayersByTeam` + `getTeamLatestRatings` para pintar la
  comparativa de compañeros en cada nivel.

## Goals / Non-Goals

**Goals**: valorar la plantilla característica a característica, con guardado por lote atómico,
sin tocar el modelo de datos ni la pantalla por jugador.

**Non-Goals**: arrastrar y soltar, notas en la hoja, borradores en servidor, validar el catálogo
en backend, Mobile.

## Decisions

### D1 · Endpoint de lote nuevo, como `ICommand` (no N llamadas al endpoint existente)

Llamar N veces a `ratings/conceptual` dejaría la plantilla a medio guardar si falla una llamada.
Un único comando guarda todo con un solo `SaveChangesAsync`.

`Features/Coaches/Players/Commands/CreateTeamRatingsBatch.cs`:

```csharp
public class CreateTeamRatingsBatch : IFeatureModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/catalog/team/{teamId}/ratings",
                [Authorize(Roles = "Coach,Administrator")] async (string teamId, CreateTeamRatingsBatchRequest req, IMediator mediator, CancellationToken ct) =>
                    Results.Ok(await mediator.Send(new CreateTeamRatingsBatchCommand(teamId, req), ct)))
            .WithName(nameof(CreateTeamRatingsBatch))
            .WithTags(PlayerConstants.PlayerFeature);
    }

    public record RatingAnswerRequest(string CharacteristicKey, string CategoryKey, int Level, string Concept);
    public record PlayerRatingRequest(string TeamPlayerId, bool IsGoalkeeper, IReadOnlyList<RatingAnswerRequest> Answers, string? Notes);
    public record CreateTeamRatingsBatchRequest(IReadOnlyList<PlayerRatingRequest> Ratings, DateTimeOffset? RatedAt = null);
    public record CreateTeamRatingsBatchCommand(string TeamId, CreateTeamRatingsBatchRequest Request)
        : ICommand<IReadOnlyList<CreateConceptualRating.ConceptualRatingResponse>>;
}
```

- Respuesta: se reutiliza `CreateConceptualRating.ConceptualRatingResponse` y su `ToResponse`
  (misma forma que `ratings/latest`), para que el front la trate como `PlayerRating[]`.
- **Validador** (`AbstractValidator<CreateTeamRatingsBatchCommand>`): `TeamId` no vacío;
  `Ratings` entre 1 y 100; `TeamPlayerId` no vacío y sin repetir; por item, `Answers` no vacío,
  claves y concepto no vacíos, `Level` 1–10, `CharacteristicKey` sin repetir; `Notes` ≤ 500.
- **Handler**:
  1. equipo (`Id`, `ClubId`) → si no existe, `NotFoundException("Equipo no encontrado", "TeamNotFound")`;
  2. permiso: Administrator, o `TeamEditAuthorization.CanEditAsync(...)`; si no,
     `ForbiddenAccessException` (mismo patrón que `AvailabilityAuthorization.EnsureCanManageTeamAsync`);
  3. todos los `TeamPlayerId` pertenecen al equipo; si no,
     `DomainException(..., ErrorCodes.RatingPlayerNotInTeam)`;
  4. `TeamPlayerRating.CreateConceptual(...)` por item, con el mismo `RatedAt`; `AddRange`;
     un `SaveChangesAsync`;
  5. devuelve las valoraciones creadas.
- Sin `IRequireFeaturePermission`: se mantiene el criterio de los endpoints de valoración
  hermanos (rol + comprobación de equipo).
- Sin migración y sin cambios en `TeamPlayerRating`.
- No se valida que cada jugador traiga **todas** las características: el catálogo vive en el
  front (igual que hoy con `allAnswered` en `NewRatingPage`).

### D2 · La hoja es una página nueva; el estado vive en un hook y la lógica en funciones puras

```
pages/squad/rating/
  positionCategory.ts          → positionCategory(), isGoalkeeperPosition() (extraído)
  ratingSheet.ts               → funciones puras (ver abajo)
  useRatingSheet.ts            → carga, borrador, selección, guardado
  RatingSheetPage.tsx (+ .module.css)
  components/
    RatingSheetBoard.tsx (+ .module.css)   → niveles + «Sin colocar» + chips
```

`ratingSheet.ts` (sin React, testeado aparte):

```ts
export type SheetType = "field" | "goalkeeper";
export type SheetDraft = Record<string, Record<string, number>>; // teamPlayerId → característica → nivel

characteristicsFor(sheet): CharacteristicDef[]
buildInitialDraft(players, latestRatings): SheetDraft   // ignora respuestas ajenas a la hoja del jugador
changedPlayerIds(players, draft, baseline): string[]
isComplete(sheet, playerDraft): boolean
buildBatchItems(players, draft, baseline, latestRatings): PlayerRatingPayload[]
```

- La hoja de cada jugador la decide su **posición** (`isGoalkeeperPosition(player.position)`), no
  el `isGoalkeeper` de su última valoración.
- `baseline` es el borrador inicial; «ha cambiado» = su mapa de niveles difiere del de `baseline`.
  Tras guardar, `baseline` pasa a ser el borrador actual.
- `concept` y `categoryKey` de cada respuesta se resuelven del catálogo al construir el lote.
- `notes` del item = notas de la última valoración del jugador (las notas se editan en la
  pantalla individual).

### D3 · Colocar tocando, con selección múltiple

- Chip = `<button aria-pressed>` con nombre y dorsal. Nivel = `<button>` con `aria-label`
  «Nivel 6» que contiene el concepto y, debajo, sus chips.
- `selectedIds: Set<string>`; tocar un chip lo añade o lo quita; tocar un nivel (o «Sin colocar»)
  con selección aplica y limpia. Tocar un nivel sin selección no hace nada.
- Sin arrastrar: en móvil compite con el scroll de una lista de 10 niveles, y el arrastre nativo
  ya ha dado problemas en Chrome.

### D4 · Layout responsive, sin tablas

- Escritorio: mismo `splitLayout` que `NewRatingPage` (lista de características a la izquierda,
  niveles a la derecha).
- Móvil (<900px): la lista de características pasa a un `TextField select`; los niveles se apilan
  y los chips hacen `flex-wrap`. «Sin colocar» queda fija arriba del tablero.
- Colores y espaciados: los de `NewRatingPage.module.css`; color de línea del chip =
  `positionAccent` existente (se mueve a `positionCategory.ts`).

### D5 · Barra de acciones

`ToggleButtonGroup` Jugadores/Porteros · filtro de línea (solo Jugadores) · fecha · «Volver» ·
«Guardar (n)». Debajo, un `Alert` de aviso con los jugadores incompletos. «Volver» con cambios →
`ConfirmDialog`. Mensajes de resultado por el bus `rffm.show_snackbar`.

### D6 · Punto de entrada

Botón «Valorar plantilla» en la `toolbar` de `SquadRatings` (ya oculta cuando `readOnly`), que
navega a `/coach/squad/rating-sheet` conservando la query. Ruta lazy en `routes.tsx` bajo
`RequireFeaturePermission(COACH_FEATURE_ROUTES.Squad)`, declarada junto a las de `rating/*`.

## Risks / Trade-offs

- **Jugador mal clasificado por posición** (sin posición → hoja de Jugadores): es el mismo
  criterio que usa hoy `NewRatingPage`; se corrige editando la demarcación.
- **Cambios perdidos al recargar**: el borrador vive en memoria. Se asume; guardar borradores en
  servidor queda fuera de alcance.
- **El backend acepta valoraciones incompletas**: ya ocurre hoy; la hoja no envía incompletas.
