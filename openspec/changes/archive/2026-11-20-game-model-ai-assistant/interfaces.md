## Step 1: Version marker on the game model aggregate

**Interfaces**:
- `GameModel.Version : Guid` (public getter, private setter, initialized to `Guid.NewGuid()` in every constructor).
- `GameModel.Touch() : void` (replaces `Version` with a new Guid).
- `GameModelConfiguration`: `builder.Property(x => x.Version).IsRequired().IsConcurrencyToken()`.

**Test assertions**:
- A newly constructed `GameModel` has `Version != Guid.Empty` — `openspec/changes/game-model-ai-assistant/specs/game-model/spec.md` § The game model carries a version marker.
- After `Touch()`, `Version` differs from its previous value — spec `game-model` § Scenario: Marker changes on save.
- `UpdateGameModelHandler` applied to a stored model leaves the stored `Version` different from before the call — spec `game-model` § Scenario: Marker changes on save.
- Applying all migrations to a database that already holds a game model row leaves that row with a non-empty `Version` — spec `game-model` § Scenario: Model without a marker.

## Step 2: Return the marker on read and check it on update

**Interfaces**:
- `GameModelResponse` gains `string Version` (the Guid in `"D"` format).
- `UpdateGameModelCommand` gains a trailing optional `string? ExpectedVersion = null` on its request record.
- `ErrorCodes.GameModelStale = "GameModelStale"`.
- `AddCustomProblemDetails` maps `DbUpdateConcurrencyException` raised for `GameModel` to `409` with code `GameModelStale`.

**Test assertions**:
- Reading a model returns a non-empty `version`; two reads with no save between return equal values — spec `game-model` § Scenario: Marker is stable between reads.
- Reading, saving, reading again returns a different `version` — spec `game-model` § Scenario: Marker changes on save.
- Update with `ExpectedVersion` equal to the current marker returns success and stores the change — spec `game-model` § Scenario: Matching expected marker.
- Update with an outdated `ExpectedVersion` returns `409` `ProblemDetails` with `code = "GameModelStale"`, and the stored model is unchanged — spec `game-model` § Scenario: Stale expected marker.
- Update with `ExpectedVersion = null` succeeds as before — spec `game-model` § Scenario: No expected marker.
- Two concurrent updates carrying the same expected marker: one succeeds and one returns `409` `GameModelStale` — spec `game-model` § Scenario: Stale expected marker.

## Step 3: Backend node addresses

**Interfaces**:
- `public enum AssistantNodeType { Principio, Subprincipio, Zona, SubSubPrincipio, Habilidad, Nota, SetPieceRule }`.
- `public sealed record NodeAddress(string Address, AssistantNodeType NodeType, string? ParentAddress);`
- `public static class GameModelNodeAddresses { public static IReadOnlyList<NodeAddress> List(GameModel model); }`.

**Test assertions**:
- For a model with one principle, one subprincipio, one zone and one sub-subprincipio, `List` returns each node's stable key as its `Address`, with `ParentAddress` equal to the parent's address and `null` for the principle — `openspec/changes/game-model-ai-assistant/specs/game-model-ai-proposals/spec.md` § Scenario: Card on the affected node.
- A skill under a zone appears as `"{zoneAddress}/hab:{id}"` and a note as `"{parentAddress}/nota:{id}"`; each literal must equal the corresponding literal in the front-end `gameModelNodeAddress.test.ts` — spec `game-model-ai-proposals` § Scenario: Card on the affected node.
- A set-piece rule appears as `"set-pieces/{id}"` — spec `game-model-ai-proposals` § Scenario: Card on the affected node.
- Addresses are unique across one model — spec `game-model-ai-proposals` § Requirement: A node has at most one proposed change.

## Step 4: Reply envelope, schema and proposal validator

**Interfaces**:
- `public enum AssistantReplyKind { Question, Proposal }`; `public enum AssistantOperation { Add, Change, Remove }`.
- `public sealed record AssistantChange(string Id, AssistantOperation Operation, AssistantNodeType NodeType, string? Address, string? ParentAddress, string? ParentChangeId, IReadOnlyDictionary<string, JsonElement> Fields);`
- `public sealed record AssistantEnvelope(AssistantReplyKind Kind, string Message, IReadOnlyList<AssistantChange> Changes);`
- `public static class GameModelAssistantEnvelope { public const string JsonSchema; public static bool TryParse(string json, out AssistantEnvelope? envelope, out string? error); }`
- `public sealed record ValidatedProposal(IReadOnlyList<AssistantChange> Changes, int DiscardedCount);`
- `public static class GameModelProposalValidator { public static ValidatedProposal Validate(GameModel model, AssistantEnvelope envelope); }`

**Test assertions**:
- `TryParse` returns true for a proposal envelope matching the schema — `openspec/changes/game-model-ai-assistant/specs/game-model-ai-assistant/spec.md` § Scenario: Valid proposal.
- `TryParse` returns false for an unknown `kind`, an unknown member, an unknown operation, or a non-object `fields` — spec `game-model-ai-assistant` § Requirement: The assistant reply is a typed envelope validated against a closed schema.
- A `question` envelope parses with an empty `Changes` list — spec `game-model-ai-assistant` § Scenario: Question carries no changes.
- A change to an address that is not in the model is discarded and `DiscardedCount` is 1 — `openspec/changes/game-model-ai-assistant/specs/game-model-ai-proposals/spec.md` § Scenario: Change to a missing node.
- An add of a skill whose name is outside `Habilidad.Vocabulary` is discarded — spec `game-model-ai-proposals` § Scenario: Invalid field.
- Five changes of which two are invalid return three changes and `DiscardedCount = 2` — spec `game-model-ai-proposals` § Scenario: Count of discarded changes.
- Two changes with the same `Address` keep the first and `DiscardedCount = 1` — spec `game-model-ai-proposals` § Scenario: Two changes for the same node.
- An add with `ParentChangeId` that points to an earlier valid add is kept; if that parent is discarded, the dependent is discarded and counted — spec `game-model-ai-proposals` § Requirement: A dependent change follows its parent.
- Two adds under the same `ParentAddress` are both kept — spec `game-model-ai-proposals` § Requirement: A node has at most one proposed change.

## Step 5: Forced JSON schema in the provider layer

**Interfaces**:
- `AiChatRequest(IReadOnlyList<AiChatMessage> Messages, int? MaxTokens = null, string? ResponseSchema = null)`.
- `IAiChatAdapter` gains `bool SupportsForcedJsonSchema { get; }`.

**Test assertions**:
- The OpenAI-compatible adapter body contains `response_format` with the schema when `ResponseSchema` is set and `SupportsForcedJsonSchema` is true — `openspec/changes/game-model-ai-assistant/specs/game-model-ai-assistant/spec.md` § Requirement: The assistant reply is a typed envelope validated against a closed schema.
- The same adapter body has no `response_format` member when `ResponseSchema` is null — spec `game-model-ai-assistant` § same requirement.
- The Claude adapter reports `SupportsForcedJsonSchema = false` and its body is identical with or without `ResponseSchema` — spec `game-model-ai-assistant` § same requirement.
- A request with `MaxTokens = 4096` sends 4096 in the body — spec `game-model-ai-assistant` § Scenario: Valid proposal.

## Step 6: Player condition service

**Interfaces**:
- `public sealed record PlayerCondition(string TeamPlayerId, int Fatigue, int? Readiness, int? FormStatus);`
- `public sealed class PlayerConditionService { public Task<IReadOnlyList<PlayerCondition>> GetForTeamAsync(string teamId, CancellationToken ct); }`
- `GetTeamPlayerStatisticsHandler` constructor gains `PlayerConditionService`; its response type is unchanged.

**Test assertions**:
- For a team with one player and fixed-date trainings and matches, `GetForTeamAsync` returns a `Fatigue` equal to `PlayerFatigueCalculator.Calculate` for the same inputs — `openspec/changes/game-model-ai-assistant/specs/game-model-ai-assistant/spec.md` § Scenario: Player data in the context.
- A player who left the team (`LeftDate` set) is not returned — spec `game-model-ai-assistant` § Scenario: Player data in the context.
- The statistics endpoint response for the existing test data is identical before and after the extraction — spec `game-model-ai-assistant` § Scenario: Player data in the context.

## Step 7: Own-team forecast service

**Interfaces**:
- `public sealed record OwnTeamForecast(IReadOnlyList<ForecastMatch> PendingMatches, int? ProjectedPosition);`
- `public sealed record ForecastMatch(DateOnly? Date, string Opponent, double HomeWinProbability, double DrawProbability, double AwayWinProbability);`
- `public sealed class OwnTeamForecastService { public Task<OwnTeamForecast?> GetAsync(string teamId, CancellationToken ct); }` (returns null when no federation data exists).
- `GetRivalSimulationHandler` constructor gains `OwnTeamForecastService`; its response type is unchanged.

**Test assertions**:
- With no federation data `GetAsync` returns null — `openspec/changes/game-model-ai-assistant/specs/game-model-ai-assistant/spec.md` § Requirement: The provider context is built by the backend from an allowlist.
- With a stubbed loader result for three pending matches it returns three `ForecastMatch` entries whose three probabilities sum to 1 within 0.001 — spec `game-model-ai-assistant` § same requirement.
- The rival-simulation endpoint response for the existing test data is identical before and after the extraction — spec `game-model-ai-assistant` § same requirement.

## Step 8: Allowlisted context builder and assistant options

**Interfaces**:
- `public sealed class GameModelAssistantOptions { public const string SectionName = "GameModelAssistant"; public int MaxClarifyingRounds { get; set; } = 2; public int MaxContextCharacters { get; set; } = 60000; public int MaxOutputTokens { get; set; } = 4096; public int SessionWindowDays { get; set; } = 30; public int MaxMessages { get; set; } = 40; public int MaxMessageLength { get; set; } = 4000; }`
- `public sealed record AssistantInjuryContext(string InjuryType, DateOnly StartDate, DateOnly? EndDate, string? EstimatedRecovery);`
- `public sealed record AssistantPlayerContext(string Alias, IReadOnlyList<AssistantInjuryContext> Injuries, int? Fatigue, int? Readiness, int? FormStatus);`
- `public sealed record AssistantSessionContext(DateOnly? Date, string? GeneralObjective);`
- `public sealed record AssistantContext(string Text, Guid ModelVersion);`
- `public sealed class GameModelAssistantContextBuilder { public Task<AssistantContext> BuildAsync(GameModel model, string teamId, CancellationToken ct); }` (throws `DomainException` with code `GameModelAssistantContextTooLarge` when `Text.Length` exceeds `MaxContextCharacters`).

**Test assertions**:
- For a player with DNI `12345678Z`, phone `600111222`, email `jugador@example.com`, full name `Juan Perez Lopez` and an injury description `lesion causada por Pedro Gomez`, `Text` contains none of those five strings — `openspec/changes/game-model-ai-assistant/specs/game-model-ai-assistant/spec.md` § Scenario: Tests assert that identifying fields are absent.
- The same injury appears with its type, start date, end date and estimated recovery — spec `game-model-ai-assistant` § Scenario: Injury free text excluded.
- Each player appears by alias with fatigue, and no full name appears — spec `game-model-ai-assistant` § Scenario: Player data in the context.
- `Text` lists each model node with its address and contains the `objetivo-temporada` note text and the session general objective — spec `game-model-ai-assistant` § Requirement: The provider context is built by the backend from an allowlist.
- `AssistantPlayerContext` and `AssistantInjuryContext` have exactly the members listed in the interfaces, so a field added to `Player` is not sent — spec `game-model-ai-assistant` § Scenario: A personal field added later.
- With `MaxContextCharacters = 100` and a larger context, `BuildAsync` throws `DomainException` with code `GameModelAssistantContextTooLarge` and no text is returned — spec `game-model-ai-assistant` § Scenario: Context over the limit.
- `ModelVersion` equals the stored model `Version` — `openspec/changes/game-model-ai-assistant/specs/game-model-ai-proposals/spec.md` § Requirement: A stale proposal cannot be saved.
- Changing `MaxClarifyingRounds` in configuration is visible through `IOptionsMonitor<GameModelAssistantOptions>` without recompiling — spec `game-model-ai-assistant` § Scenario: Maximum read from configuration.

## Step 9: Assistant endpoint

**Interfaces**:
- Route `POST /api/game-models/{gameModelId}/assistant`.
- `public sealed record AssistantMessageDto(string Role, string Content, string? Kind);` (`Role` is `user` or `assistant`; `Kind` is `question` or `proposal` for assistant messages).
- `public sealed record ChatWithGameModelAssistantRequest(IReadOnlyList<AssistantMessageDto> Messages);`
- `public sealed record ChatWithGameModelAssistantCommand(string GameModelId, ChatWithGameModelAssistantRequest Request) : ICommand<AssistantReplyDto>, IRequireFeaturePermission` (`FeatureRoute = CoachFeatureRoutes.GameModel`, `RequiredPermission = "ReadWrite"`).
- `public sealed record AssistantChangeDto(string Id, string Operation, string NodeType, string? Address, string? ParentAddress, string? ParentChangeId, IReadOnlyDictionary<string, JsonElement> Fields);`
- `public sealed record AssistantReplyDto(string Kind, string Message, IReadOnlyList<AssistantChangeDto> Changes, int DiscardedCount, string Version);`
- `ErrorCodes.GameModelAssistantInvalidReply`, `ErrorCodes.GameModelAssistantContextTooLarge`, `ErrorCodes.AiNoActiveProvider`.

**Test assertions**:
- A user without `ReadWrite` on the game-model feature gets forbidden and the fake `IAiChatCompletionService` records zero calls — `openspec/changes/game-model-ai-assistant/specs/game-model-ai-assistant/spec.md` § Scenario: Read-only user.
- For a caller with write permission and no active AI provider, the call returns `409` `ProblemDetails` with `code = "AiNoActiveProvider"` and the text "No tienes ningún proveedor de IA activo.", the fake adapter records zero outbound calls, and the model is unchanged — `openspec/changes/game-model-ai-assistant/specs/game-model-ai-assistant/spec.md` § Scenario: No active provider.
- A provider reply of kind `question` returns `Kind = "question"`, the message, and an empty `Changes` — spec `game-model-ai-assistant` § Scenario: Ambiguous request.
- When the messages already hold two assistant messages of kind `question` and `MaxClarifyingRounds = 2`, the prompt sent to the provider tells it to propose and state its assumptions; a `question` reply is retried once — spec `game-model-ai-assistant` § Scenario: Maximum rounds reached.
- A first reply that fails the schema and a valid second reply return the second reply and the provider is called exactly twice — spec `game-model-ai-assistant` § Scenario: Invalid reply retried once.
- Two invalid replies return `ProblemDetails` with `code = "GameModelAssistantInvalidReply"`, status 502, and the stored model is unchanged — spec `game-model-ai-assistant` § Scenario: Invalid reply twice.
- A proposal with five changes of which two are invalid returns three changes and `DiscardedCount = 2`, and `Version` equals the stored marker — `openspec/changes/game-model-ai-assistant/specs/game-model-ai-proposals/spec.md` § Scenario: Count of discarded changes.
- A provider failure `QuotaExceeded` returns `ProblemDetails` whose `detail` is the `AiChatFailureMessages` text for quota — spec `game-model-ai-assistant` § Scenario: Quota exceeded.
- After any call, the game model and every other table row are unchanged and no conversation row exists — spec `game-model-ai-assistant` § Scenario: Closing the chat.
- A request whose last message is not from the user, or with more than `MaxMessages` messages, returns 400 — spec `game-model-ai-assistant` § Scenario: Conversation sent with each request.

## Step 10: Front service types and additive pending-change types

**Interfaces**:
- `ApiGameModel` gains `version: string`.
- `gameModelService.update(draft: GameModelDraft, options?: { expectedVersion?: string }): Promise<void>`.
- `type AssistantMessage = { role: 'user' | 'assistant'; content: string; kind?: 'question' | 'proposal' };`
- `type AssistantChange = { id: string; operation: 'add' | 'change' | 'remove'; nodeType: 'principio' | 'subprincipio' | 'zona' | 'subSubPrincipio' | 'habilidad' | 'nota' | 'setPieceRule'; address?: string; parentAddress?: string; parentChangeId?: string; fields: Record<string, unknown> };`
- `type AssistantReply = { kind: 'question' | 'proposal'; message: string; changes: AssistantChange[]; discardedCount: number; version: string };`
- `gameModelService.assistant(gameModelId: string, messages: AssistantMessage[]): Promise<AssistantReply>`.
- `PendingChange` gains optional `changeId?: string` and `canAccept?: boolean`; `PendingChanges` keeps its current shape for existing callers and supports several adds under one parent.

**Test assertions**:
- Mapping a read response with `version: "v1"` yields `ApiGameModel.version === "v1"` — `openspec/changes/game-model-ai-assistant/specs/game-model/spec.md` § Scenario: Marker is stable between reads.
- `update(draft, { expectedVersion: "v1" })` sends `expectedVersion: "v1"` in the PUT body; without options the body has no `expectedVersion` — spec `game-model` § Scenario: No expected marker.
- `assistant("id", messages)` posts `{ messages }` to `/api/game-models/id/assistant` and returns the parsed reply — `openspec/changes/game-model-ai-assistant/specs/game-model-ai-assistant/spec.md` § Scenario: Conversation sent with each request.
- A `409` with code `GameModelStale` makes `update` reject with an error whose `code` is `GameModelStale` — spec `game-model` § Scenario: Stale expected marker.
- `buildReadingTree` with two pending adds under the same parent yields two placeholder nodes, each carrying its `changeId` — `openspec/changes/game-model-ai-assistant/specs/game-model-ai-proposals/spec.md` § Scenario: Card for an add.

## Step 11: Proposal tree module

**Interfaces**:
- `export type ProposalStatus = 'pending' | 'accepted' | 'rejected';`
- `export type TrackedChange = AssistantChange & { status: ProposalStatus };`
- `export function applyChange(model: GameModel, change: AssistantChange): GameModel` (returns a new tree).
- `export function canAccept(change: TrackedChange, all: TrackedChange[]): boolean`.
- `export function rejectWithDependents(all: TrackedChange[], changeId: string): TrackedChange[]`.
- `export function discardOrphans(model: GameModel, all: TrackedChange[]): { changes: TrackedChange[]; discarded: number }`.

**Test assertions**:
- Accepting one of two changes applies only that change to the returned tree and leaves the other `pending` — `openspec/changes/game-model-ai-assistant/specs/game-model-ai-proposals/spec.md` § Scenario: Accept one card.
- Rejecting a change leaves the tree identical and marks the change `rejected` — spec `game-model-ai-proposals` § Scenario: Reject one card.
- `canAccept` is false for a change whose `parentChangeId` points to a `pending` change, and true once that parent is `accepted` — spec `game-model-ai-proposals` § Scenario: Dependent before parent.
- `rejectWithDependents` on a parent with two dependents marks all three `rejected` — spec `game-model-ai-proposals` § Scenario: Parent rejected.
- After applying a removal of a subprincipio, `discardOrphans` drops a pending change to one of its zones and returns `discarded = 1` — spec `game-model-ai-proposals` § Scenario: Node removed by an accepted change.
- Applying three accepted changes in sequence yields one tree holding all three — spec `game-model-ai-proposals` § Scenario: Several accepted changes.
- `applyChange` never mutates its input tree — spec `game-model-ai-proposals` § Requirement: The assistant never changes the model without per-card acceptance.

## Step 12: Cards with accept and reject in the read view

**Interfaces**:
- `GameModelReadingView` props gain `onAcceptChange?: (changeId: string) => void` and `onRejectChange?: (changeId: string) => void`.
- `ReadingNodeView` and `PlaceholderCard` receive the two callbacks through the reading context.

**Test assertions**:
- A pending change on a subprincipio renders the proposed text, a button named "Aceptar" and a button named "Rechazar" on that node — `openspec/changes/game-model-ai-assistant/specs/game-model-ai-proposals/spec.md` § Scenario: Card on the affected node.
- A pending add renders its card inside the placeholder under the parent principle — spec `game-model-ai-proposals` § Scenario: Card for an add.
- With `canAccept: false` the "Aceptar" button is not available (disabled) — spec `game-model-ai-proposals` § Scenario: Dependent before parent.
- Clicking "Aceptar" calls `onAcceptChange` once with that card's `changeId`; clicking "Rechazar" calls `onRejectChange` with it — spec `game-model-ai-proposals` § Requirement: Cards are accepted or rejected independently.
- With no pending changes and no callbacks the view renders as before — spec `game-model-ai-proposals` § Requirement: One card per node in the read view.

## Step 13: Assistant hook

**Interfaces**:
- `export function useGameModelAssistant(args: { gameModelId: string; model: GameModel; onModelChange: (next: GameModel) => void }): { messages: AssistantMessage[]; changes: TrackedChange[]; proposalVersion?: string; sending: boolean; error?: string; send(text: string): Promise<void>; retry(): Promise<void>; accept(changeId: string): void; reject(changeId: string): void; close(): void }`

**Test assertions**:
- Sending a second message calls `gameModelService.assistant` with both earlier messages and the new one — `openspec/changes/game-model-ai-assistant/specs/game-model-ai-assistant/spec.md` § Scenario: Conversation sent with each request.
- A service error sets `error` and keeps `messages`; `retry()` calls the service with the same messages — spec `game-model-ai-assistant` § Scenario: Retry after an error.
- A `question` reply appends the message and leaves `changes` empty — spec `game-model-ai-assistant` § Scenario: Question carries no changes.
- A proposal reply with `discardedCount = 2` dispatches one `rffm.show_snackbar` event whose message mentions 2 discarded changes — `openspec/changes/game-model-ai-assistant/specs/game-model-ai-proposals/spec.md` § Scenario: Count of discarded changes.
- `accept(id)` calls `onModelChange` with the tree returned by `applyChange` and sets that change to `accepted`; a dependent's accept does nothing until the parent is accepted — spec `game-model-ai-proposals` § Scenario: Accept one card.
- After accepting a removal that orphans a pending change, a snackbar event is dispatched and the orphan is dropped — spec `game-model-ai-proposals` § Scenario: Node removed by an accepted change.
- `close()` empties `messages` and `changes` — spec `game-model-ai-assistant` § Scenario: Closing the chat.

## Step 14: Assistant panel and game-model page integration

**Interfaces**:
- `export default function GameModelAssistantPanel(props: { open: boolean; onClose: () => void; messages: AssistantMessage[]; sending: boolean; error?: string; onSend: (text: string) => void; onRetry: () => void }): JSX.Element`
- `GameModel.tsx` gains an "Asistente" toolbar button, a local draft tree, and a "Guardar cambios del asistente" action calling `gameModelService.update(draft, { expectedVersion: proposalVersion })` once.

**Test assertions**:
- Opening the panel shows a notice naming the game model, objectives, sessions, forecasts and the alias, injuries and physical condition of the players as sent to the provider, and stating that identifying personal data is not sent — `openspec/changes/game-model-ai-assistant/specs/game-model-ai-assistant/spec.md` § Scenario: Notice visible.
- A user without the `ReadWrite` feature permission and without Administrator role sees no assistant button — spec `game-model-ai-assistant` § Requirement: The assistant is available only with write permission and an active provider.
- A coach with write permission and an active provider sees the button enabled — spec `game-model-ai-assistant` § Scenario: Coach with write permission and an active provider.
- With no provider whose `isActive` is true, the button is disabled and a link to the "Ajustes de IA" route is shown — spec `game-model-ai-assistant` § Scenario: No active provider.
- Accepting two of three cards and pressing save sends one update request whose tree holds exactly the two accepted changes and `expectedVersion` equal to the proposal marker — `openspec/changes/game-model-ai-assistant/specs/game-model-ai-proposals/spec.md` § Scenario: Several accepted changes.
- Rejecting every card and the save action being unavailable leaves no update request — spec `game-model-ai-proposals` § Scenario: Nothing accepted.
- A failed update leaves the displayed saved model unchanged — spec `game-model-ai-proposals` § Scenario: Failed save.
- An update rejected with code `GameModelStale` reloads the model, clears the proposal and dispatches a snackbar asking to regenerate the proposal — spec `game-model-ai-proposals` § Scenario: Model changed after the proposal.
- Closing the panel while a proposal is pending clears the conversation and the cards — spec `game-model-ai-assistant` § Scenario: Closing the chat.
