## Backend (`Back/ExtractionApi/`)

### New feature file — `Features/Coaches/GameModels/Commands/MoveScenarioLocation.cs`

Follows the `ToggleSkillMastered.cs` pattern (single-purpose PATCH, `IFeatureModule`, access check by joining up to `UserClubs`) rather than `UpdateGameModel`'s full-resave pattern.

```csharp
public class MoveScenarioLocation : IFeatureModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapPatch("/api/game-models/scenarios/{scenarioId}/location",
                async (string scenarioId, MoveScenarioLocationRequest request, HttpContext httpContext,
                       IMediator mediator, CancellationToken ct) =>
                {
                    var userId = httpContext.User.Claims
                        .FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;
                    if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

                    var result = await mediator.Send(
                        new MoveScenarioLocationCommand(scenarioId, request.GameMomentId, request.GameZoneId, userId), ct);
                    return Results.Ok(result);
                })
            .WithName(nameof(MoveScenarioLocation))
            .WithTags(GameModelConstants.Tag)
            .RequireAuthorization()
            .Produces<MoveScenarioLocationResult>()
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
            .Produces<ProblemDetails>(StatusCodes.Status403Forbidden);
    }
}

public record MoveScenarioLocationRequest(int GameMomentId, int GameZoneId);

public record MoveScenarioLocationCommand(
    string ScenarioId, int GameMomentId, int GameZoneId, string UserId) : IRequest<MoveScenarioLocationResult>, IRequireFeaturePermission
{
    public string FeatureRoute => CoachFeatureRoutes.GameModel;
    public string RequiredPermission => "ReadWrite";
}

public record MoveScenarioLocationResult(int Order);
```

### Handler

```csharp
public class MoveScenarioLocationHandler : IRequestHandler<MoveScenarioLocationCommand, MoveScenarioLocationResult>
{
    private readonly AppDbContext _db;
    public MoveScenarioLocationHandler(AppDbContext db) => _db = db;

    public async ValueTask<MoveScenarioLocationResult> Handle(MoveScenarioLocationCommand request, CancellationToken ct = default)
    {
        var scenario = await _db.GameScenarios
            .FirstOrDefaultAsync(s => s.Id == request.ScenarioId, ct);
        if (scenario is null)
            throw new DomainException("Modelo de Juego", "Escenario no encontrado.", ErrorCodes.GameModelNotFound);

        // Same access-check shape as ToggleSkillMastered/UpdateGameModel: GameScenario → GameModel → Team → Club → UserClub
        var hasAccess = await _db.GameScenarios
            .Where(s => s.Id == request.ScenarioId)
            .Join(_db.GameModels, s => s.GameModelId, gm => gm.Id, (s, gm) => gm)
            .Join(_db.Teams, gm => gm.TeamId, t => t.Id, (gm, t) => t)
            .Join(_db.UserClubs, t => t.ClubId, uc => uc.ClubId, (t, uc) => uc)
            .AnyAsync(uc => uc.ApplicationUserId == request.UserId, ct);
        if (!hasAccess)
            throw new DomainException("Modelo de Juego", "No tienes acceso a este modelo de juego.", ErrorCodes.GameModelAccessDenied);

        var siblingsInModel = await _db.GameScenarios
            .Where(s => s.GameModelId == scenario.GameModelId && s.Id != scenario.Id)
            .ToListAsync(ct);

        var sameLocation = scenario.GameMomentId == request.GameMomentId && scenario.GameZoneId == request.GameZoneId;
        if (sameLocation)
            return new MoveScenarioLocationResult(scenario.Order);

        var (oldMomentId, oldZoneId) = (scenario.GameMomentId, scenario.GameZoneId);

        var newOrder = siblingsInModel
            .Count(s => s.GameMomentId == request.GameMomentId && s.GameZoneId == request.GameZoneId) + 1;

        scenario.UpdateMomentAndZone(request.GameMomentId, request.GameZoneId);
        scenario.UpdateOrder(newOrder);

        // Renumber the scenarios left behind in the source moment/zone (mirrors DEL_SCENARIO reducer on the frontend).
        var remainingInSource = siblingsInModel
            .Where(s => s.GameMomentId == oldMomentId && s.GameZoneId == oldZoneId)
            .OrderBy(s => s.Order)
            .ToList();
        for (var i = 0; i < remainingInSource.Count; i++)
            remainingInSource[i].UpdateOrder(i + 1);

        await _db.SaveChangesAsync(ct);
        return new MoveScenarioLocationResult(scenario.Order);
    }
}

public class MoveScenarioLocationValidator : AbstractValidator<MoveScenarioLocationCommand>
{
    public MoveScenarioLocationValidator()
    {
        RuleFor(x => x.ScenarioId).NotEmpty();
        RuleFor(x => x.GameMomentId).GreaterThan(0);
        RuleFor(x => x.GameZoneId).GreaterThan(0);
    }
}
```

No domain or infrastructure changes — `GameScenario.UpdateMomentAndZone`/`UpdateOrder` already exist (`Domain/Aggregates/GameModels/GameScenario.cs:46-51`). No migration needed.

### Tests (write first — Red)
- `MoveScenarioLocationHandlerTests.cs` (new, same folder pattern as other handler tests):
  - Moves a scenario to a different moment/zone → `GameMomentId`/`GameZoneId` updated, `Order` = target-zone-count + 1.
  - Leaves nested `TacticalPrinciples`/`SubPrinciples` untouched (assert same ids/content survive).
  - Renumbers remaining scenarios in the source moment/zone to `1..N` contiguous.
  - Same moment/zone requested → no-op, returns current `Order`, no renumbering triggered.
  - Unknown `scenarioId` → `GameModelNotFound`.
  - User without access to the team → `GameModelAccessDenied`.
  - Validator rejects empty `ScenarioId` / non-positive `GameMomentId`/`GameZoneId`.

## Frontend (`Front/`)

### Service — `apps/coach/services/gameModelService.ts`

```ts
async moveScenarioLocation(
  scenarioApiId: string,
  gameMomentId: number,
  gameZoneId: number
): Promise<{ order: number }> {
  const res = await client.patch<{ order: number }>(
    `/api/game-models/scenarios/${scenarioApiId}/location`,
    { gameMomentId, gameZoneId }
  );
  return res.data;
},
```

### Draft reducer — `apps/coach/context/GameModelDraftContext.tsx`

New action, mirroring the renumbering already done by `DEL_SCENARIO`:

```ts
| { type: "MOVE_SCENARIO_LOCATION"; fromMi: number; fromZi: number; si: number; toMi: number; toZi: number; order?: number }
```

```ts
case "MOVE_SCENARIO_LOCATION": {
  const sourceZone = state.gameMoments[action.fromMi]?.zones[action.fromZi];
  const moved = sourceZone?.scenarios[action.si];
  if (!moved) return state;

  let withoutMoved = state;
  withoutMoved = {
    ...withoutMoved,
    gameMoments: mapAt(withoutMoved.gameMoments, action.fromMi, (m) => ({
      ...m,
      zones: mapAt(m.zones, action.fromZi, (z) => {
        const filtered = z.scenarios.filter((_, i) => i !== action.si);
        return { ...z, scenarios: filtered.map((s, i) => ({ ...s, order: i + 1 })) };
      }),
    })),
  };

  return {
    ...withoutMoved,
    gameMoments: mapAt(withoutMoved.gameMoments, action.toMi, (m) => ({
      ...m,
      zones: mapAt(m.zones, action.toZi, (z) => ({
        ...z,
        scenarios: [...z.scenarios, { ...moved, order: action.order ?? z.scenarios.length + 1 }],
      })),
    })),
  };
}
```

Reuses `mapAt` already defined in the file. When `fromMi === toMi && fromZi === toZi`, the action is simply not dispatched by the caller (no-op guarded in the component, see below).

### UI — `apps/coach/pages/game-model/components/ScenarioFormAccordion.tsx` (`ScenarioDetailForm`)

Add a "Mover a…" block above or alongside the tactical-principles `Autocomplete`, using two MUI `Select`s (Momento, Zona) sourced from `draft.gameMoments` (moment options) and `draft.gameMoments[mi].zones` (zone options — identical catalog across all moments per `buildEmptyDraft`), plus a "Mover" `Button`:

```tsx
const { draft, dispatch, availablePrinciples } = useGameModelDraft();
const [targetMi, setTargetMi] = useState(mi);
const [targetZi, setTargetZi] = useState(zi);
const [moving, setMoving] = useState(false);

const isSameLocation = targetMi === mi && targetZi === zi;

const handleMove = async () => {
  if (isSameLocation) return;
  setMoving(true);
  try {
    if (scenario.apiId) {
      const targetMoment = draft.gameMoments[targetMi];
      const targetZone = targetMoment.zones[targetZi];
      const { order } = await gameModelService.moveScenarioLocation(
        scenario.apiId, targetMoment.id, targetZone.id
      );
      dispatch({ type: "MOVE_SCENARIO_LOCATION", fromMi: mi, fromZi: zi, si, toMi: targetMi, toZi: targetZi, order });
    } else {
      dispatch({ type: "MOVE_SCENARIO_LOCATION", fromMi: mi, fromZi: zi, si, toMi: targetMi, toZi: targetZi });
    }
  } catch {
    window.dispatchEvent(new CustomEvent("rffm.show_snackbar", {
      detail: { message: "No se pudo mover el escenario.", severity: "error" },
    }));
  } finally {
    setMoving(false);
  }
};
```

- After a successful move, the moved scenario's `si` index inside the source zone no longer exists, so the parent `ScenarioFormAccordion`'s existing `useEffect` (`if (selectedSi !== null && selectedSi >= scenarios.length) setSelectedSi(null)`) already returns the user to the scenario list for that zone/moment tab — no extra navigation wiring needed. The user can switch to the target moment/zone tab manually to see the moved scenario (kept out of scope: auto-switching tabs is not part of the acceptance criteria).
- `testID`/`aria-label`s: `scenario-move-moment-select`, `scenario-move-zone-select`, button `aria-label="Mover escenario"`.

### Tests (write first — Red)
- `ScenarioFormAccordion.test.tsx`: 
  - Renders the move selects defaulted to the scenario's current moment/zone; move button disabled when target equals current location.
  - Selecting a different moment/zone and confirming, for a scenario with `apiId`, calls `gameModelService.moveScenarioLocation` with the right ids and dispatches `MOVE_SCENARIO_LOCATION` with the returned order on success.
  - For a scenario without `apiId` (unsaved), confirming dispatches `MOVE_SCENARIO_LOCATION` without calling the service.
  - On service rejection, dispatches the `rffm.show_snackbar` event and does not dispatch `MOVE_SCENARIO_LOCATION`.
- `GameModelDraftContext` reducer test (new or extended existing draft-context test file): `MOVE_SCENARIO_LOCATION` removes the scenario from the source zone and renumbers remaining source scenarios to `1..N`; appends it to the target zone preserving all nested content (subPrinciples, subSubPrinciples, essentialSkills, tacticalPrinciples, media).
