## Target State

The finished shape is one new backend endpoint that turns a stateless conversation into a validated list of proposed changes, a version marker on the game model, and a coach-page chat whose accepted changes are saved through the existing update.

### Architecture Snapshot

#### External Surfaces

- `POST /api/game-models/{gameModelId}/assistant` (`Back/ExtractionApi/src/RFFM.Api/Features/Coaches/GameModels/Commands/ChatWithGameModelAssistant.cs`): `ReadWrite` on the game-model feature plus team membership. Request `{ messages: [{ role: "user"|"assistant", content, kind?: "question"|"proposal" }] }`. Response `{ kind, message, changes[], discardedCount, version }`. Errors are `ProblemDetails` with codes `GameModelAssistantContextTooLarge` (400), `AiNoActiveProvider` (409, caller has no active provider, no outbound call), `GameModelAssistantInvalidReply` (502) and `AiProvider<Failure>` (502, 429 for quota).
- `GET /api/game-models?teamId&season` (`GetGameModel.cs`): the response gains `version` (opaque string).
- `PUT /api/game-models/{id}` (`UpdateGameModel.cs`): the request gains optional `expectedVersion`; a mismatch returns `409 Conflict` as `ProblemDetails` with code `GameModelStale` and leaves the model unchanged.
- Configuration section `GameModelAssistant` (`GameModelAssistantOptions`): `MaxClarifyingRounds` (default 2), `MaxContextCharacters`, `MaxOutputTokens`, `SessionWindowDays`, `MaxMessages`, `MaxMessageLength`.
- Reply envelope contract (finished shape, closed schema):

```json
{
  "kind": "question | proposal",
  "message": "string",
  "changes": [
    {
      "id": "c1",
      "operation": "add | change | remove",
      "nodeType": "principio | subprincipio | zona | subSubPrincipio | habilidad | nota | setPieceRule",
      "address": "node address, required for change and remove, absent for add",
      "parentAddress": "node address of the parent, add only, absent when parentChangeId is set",
      "parentChangeId": "id of an earlier add in the same reply, add only",
      "fields": { "...": "the editable fields of that node type in UpdateGameModelRequest" }
    }
  ]
}
```

#### Internal Public Surfaces

- `GameModelAssistantContextBuilder` (`.../GameModels/Assistant/`): the only code that reads data for the provider; emits allowlist records only (`AssistantModelContext`, `AssistantPlayerContext`, `AssistantInjuryContext`, `AssistantSessionContext`, `AssistantForecastContext`).
- `GameModelAssistantEnvelope` (`.../GameModels/Assistant/`): envelope records, the JSON schema text, and the parser.
- `GameModelProposalValidator` (`.../GameModels/Assistant/`): pure function from (model, envelope) to (valid changes, discarded count).
- `IAiChatCompletionService` request gains an optional `ResponseSchema`; adapters declare `SupportsForcedJsonSchema` (`Features/AiSettings/Services/AiChat.cs`, `AiChatAdapters.cs`).
- `GameModel.Version` and `GameModel.Touch()` (`Domain/Aggregates/GameModels/GameModel.cs`).
- Front: `useGameModelAssistant` (`Front/src/apps/coach/pages/game-model/hooks/`), `GameModelAssistantPanel` (`.../components/`), `gameModelProposalTree.ts` (apply, accept and reject rules), `gameModelService.assistant(...)` and `ApiGameModel.version` (`Front/src/apps/coach/services/gameModelService.ts`).
- Front: `GameModelReadingView` and `GameModelReadingNode` receive pending changes plus `onAcceptChange` and `onRejectChange` as props and hold no assistant state; `PendingChange` gains optional `changeId` and `canAccept` (`gameModelReadingTree.ts`).

### File Manifest

- M Back/ExtractionApi/src/RFFM.Api/DependencyInjection/ServiceCollectionExtensions.cs (Step 2, Step 8)
- M Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/GameModels/GameModel.cs (Step 1)
- M Back/ExtractionApi/src/RFFM.Api/Domain/ErrorCodes.cs (Step 2, Step 9)
- M Back/ExtractionApi/src/RFFM.Api/Features/AiSettings/Services/AiChat.cs (Step 5)
- M Back/ExtractionApi/src/RFFM.Api/Features/AiSettings/Services/AiChatAdapters.cs (Step 5)
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/GameModels/Assistant/GameModelAssistantContextBuilder.cs (Step 8)
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/GameModels/Assistant/GameModelAssistantEnvelope.cs (Step 4)
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/GameModels/Assistant/GameModelAssistantOptions.cs (Step 8)
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/GameModels/Assistant/GameModelNodeAddresses.cs (Step 3)
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/GameModels/Assistant/GameModelProposalValidator.cs (Step 4)
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/GameModels/Commands/ChatWithGameModelAssistant.cs (Step 9)
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/GameModels/Commands/UpdateGameModel.cs (Step 1, Step 2)
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/GameModels/Queries/GetGameModel.cs (Step 2)
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/MatchForecast/GetRivalSimulation.cs (Step 7)
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/MatchForecast/Services/OwnTeamForecastService.cs (Step 7)
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Players/Queries/GetTeamPlayerStatistics.cs (Step 6)
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Players/Services/PlayerConditionService.cs (Step 6)
- A Back/ExtractionApi/src/RFFM.Api/Infrastructure/Migrations/2026*_AddGameModelVersion.Designer.cs — generated count=1 (Step 1)
- A Back/ExtractionApi/src/RFFM.Api/Infrastructure/Migrations/2026*_AddGameModelVersion.cs — generated count=1 (Step 1)
- M Back/ExtractionApi/src/RFFM.Api/Infrastructure/Migrations/AppDbContextModelSnapshot.cs (Step 1)
- M Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/Configuration/Aggregates/GameModels/GameModelConfiguration.cs (Step 1)
- M Back/ExtractionApi/src/RFFM.Host/appsettings.json (Step 8)
- A Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/ChatWithGameModelAssistantHandlerTests.cs (Step 9)
- A Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/GameModelAssistantContextBuilderTests.cs (Step 8)
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/GetGameModelHandlerTests.cs (Step 2)
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/RivalSimulationTests.cs (Step 7)
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/UpdateGameModelHandlerTests.cs (Step 1, Step 2)
- M Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/AiChatAdaptersTests.cs (Step 5)
- A Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/GameModelAssistantEnvelopeTests.cs (Step 4)
- A Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/GameModelNodeAddressesTests.cs (Step 3)
- A Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/GameModelProposalValidatorTests.cs (Step 4)
- A Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/GameModelVersionTests.cs (Step 1)
- M Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/GetTeamPlayerStatisticsHandlerTests.cs (Step 6)
- A Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/OwnTeamForecastServiceTests.cs (Step 7)
- A Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/PlayerConditionServiceTests.cs (Step 6)
- M Front/src/apps/coach/pages/game-model/GameModel.tsx (Step 14)
- M Front/src/apps/coach/pages/game-model/__tests__/GameModel.test.tsx (Step 14)
- A Front/src/apps/coach/pages/game-model/components/GameModelAssistantPanel.module.css (Step 14)
- A Front/src/apps/coach/pages/game-model/components/GameModelAssistantPanel.tsx (Step 14)
- M Front/src/apps/coach/pages/game-model/components/GameModelReadingNode.tsx (Step 12)
- M Front/src/apps/coach/pages/game-model/components/GameModelReadingView.tsx (Step 12)
- A Front/src/apps/coach/pages/game-model/components/__tests__/GameModelAssistantPanel.test.tsx (Step 14)
- M Front/src/apps/coach/pages/game-model/components/__tests__/GameModelReadingView.test.tsx (Step 12)
- A Front/src/apps/coach/pages/game-model/components/__tests__/gameModelProposalTree.test.ts (Step 11)
- M Front/src/apps/coach/pages/game-model/components/__tests__/gameModelReadingTree.test.ts (Step 10)
- A Front/src/apps/coach/pages/game-model/components/gameModelProposalTree.ts (Step 11)
- M Front/src/apps/coach/pages/game-model/components/gameModelReadingTree.ts (Step 10)
- A Front/src/apps/coach/pages/game-model/hooks/__tests__/useGameModelAssistant.test.tsx (Step 13)
- A Front/src/apps/coach/pages/game-model/hooks/useGameModelAssistant.ts (Step 13)
- M Front/src/apps/coach/services/__tests__/gameModelService.test.ts (Step 10)
- M Front/src/apps/coach/services/gameModelService.ts (Step 10)

## Context

The game-model form is slow to fill by hand. `ai-provider-settings` already provides per-user providers and `IAiChatCompletionService`; `game-model-reading-view` already renders `PendingChange` decorations from node addresses. This change connects them.

Current facts that shape the design:

- `UpdateGameModel` replaces the whole tree, removes absent nodes, and has no version check. `GameModel` has no timestamp or concurrency token, and no `IsConcurrencyToken` exists anywhere in `RFFM.Api`.
- `AiChatRequest` is `(Messages, MaxTokens)` with default `MaxTokens` 1024; adapters build anonymous JSON bodies with null fields omitted; no context-size check exists; provider failures are an `AiChatFailure` enum with Spanish messages.
- The Habilidad vocabulary is a closed set of 28 values (`Habilidad.Vocabulary`), not the 15 that the proposal notes state. The design references the set, never a count. `SetPieceRule.Subtypes` has 8 values. `Nota.Tipos` has four values, and a note has exactly one anchor node.
- There is no season-objectives entity and no stored physical condition. Objectives live in `objetivo-temporada` notes and in `TrainingSession.ObjetivoGeneral` (detail DTO only, not in the session list DTO). Fatigue, readiness and form are computed inside `GetTeamPlayerStatistics`, which is guarded by the `Squad` feature permission and team membership. The own-team forecast is `GetRivalSimulation` (`SeasonSimulator`).
- `DomainException` maps to 400 with its code and `ConflictException` to 409 in `AddCustomProblemDetails`. `ApproveClubJoinRequest` also returns an inline `Results.Conflict` with a code.
- Read view addresses: the backend key for principles, subprincipios, zones and sub-subprincipios; `hab:` and `nota:` suffixes under the parent address for skills and notes; `set-pieces/` for set-piece rules.

## Goals / Non-Goals

Goals:

- A stateless, permission-guarded, allowlist-fed assistant endpoint that returns only schema-valid, model-valid changes.
- Per-card accept and reject with dependencies, applied to a local tree and saved once.
- A version marker that makes a stale save fail with `GameModelStale`.

Non-Goals:

- No Word import and no `.docx` reading.
- No stored conversations and no assistant-driven writes to the model.
- Out of scope: a data-categories notice on the "Ajustes de IA" page — revisit when the `ai-provider-settings` spec is amended; the approved specs only require the notice in the chat panel, and without it the change still shows what leaves the app at the point of use.
- Out of scope: using the assistant on a team that has no saved game model — revisit when the specs define how a first model is created through the chat; without it the assistant is offered only when a model is loaded, and creation stays with the existing form.
- Out of scope: per-user rate limiting of the assistant endpoint — revisit when usage logs or coach reports show repeated high-volume calls; without it a coach can still spend only their own provider key, bounded per call by the limits in Risks.
- Out of scope: provider-forced JSON output for Claude — revisit when prompt-only schema enforcement shows a high retry-failure rate; without it Claude relies on the schema in the prompt, which the specs already allow.

## Decisions

### D1. The version marker is a Guid concurrency token

`GameModel` gets a non-null `Version` Guid, set on creation and replaced by `Touch()` in every save, configured as an EF concurrency token. A migration adds the column and back-fills existing rows with generated values, so a model that predates the marker is always returned with a stable persisted marker. `UpdateGameModel` compares `expectedVersion` (when supplied) with the loaded marker before applying changes, and a `DbUpdateConcurrencyException` from a race maps to the same `GameModelStale` 409. The marker is exposed as an opaque string.

- **Record family**: adr
- **Provenance**: derived
- Alternatives considered: a timestamp (clock resolution and skew make equal values possible), PostgreSQL `xmin` (not portable through the existing model, invisible to the domain, and not persisted by us as the spec requires), a numeric counter (needs an atomic increment and invites arithmetic assumptions). A Guid is unique, needs no clock, and works with EF's token check. Rationale: the check is cheap, race-safe, and independent of the database system column.

### D2. The conversation is held by the browser and the endpoint is stateless

Each request carries the full message list. Clarifying rounds already asked are derived by counting assistant messages with `kind: "question"`, so the backend needs no state. Limits (`MaxMessages`, `MaxMessageLength`) are enforced by the command validator.

- **Record family**: adr
- **Provenance**: user
- Alternatives considered: a server-side conversation table (rejected by the specs; adds retention of health-adjacent data), a signed state token. Rationale: the specs require that nothing about the conversation is stored.

### D3. Identifying data cannot reach the provider because the context is made of allowlist records

The builder projects data into dedicated records that contain only allowlisted members (`AssistantPlayerContext` has alias, injuries and condition; `AssistantInjuryContext` has type, start, end, estimated recovery). It never serializes an entity or a DTO that has a personal field, so a field added later is absent by construction. Tests build a player with DNI, phone, email, full name and an injury description naming a person, and assert none of those strings appears in the serialized context.

- **Record family**: ddr
- **Provenance**: user
- Alternatives considered: serializing entities and stripping a denylist (a new personal field leaks silently), a runtime scanner for personal values (cannot recognize free text). Rationale: the invariant is that identifying data and injury free text are never sent, and only an allowlist keeps it true when the model grows.

### D4. Sources for the "objectives", "sessions", "physical condition" and "forecasts" fields

- Objectives: `objetivo-temporada` notes of the game model plus `ObjetivoGeneral` of the team's sessions inside the window.
- Sessions: the builder queries `TrainingSession` for the team directly (date and `ObjetivoGeneral`), limited to `SessionWindowDays` before and after the current date. The session list DTO has no objective, so the list handler is not reused.
- Physical condition: fatigue, readiness and form per active player, from the same computation as `GetTeamPlayerStatistics`, extracted into a shared `PlayerConditionService` so the game-model slice does not need the `Squad` permission and `GetTeamPlayerStatistics` keeps its behavior and tests. Players with a `LeftDate` are excluded because the squad query used elsewhere does not filter them.
- Forecasts: the own-team pending-match predictions and projected position from the same `SeasonSimulator` that backs `GetRivalSimulation`; when no federation data exists the section is sent as absent.

- **Provenance**: derived

### D5. The endpoint is a command in the game-model feature area

One file `ChatWithGameModelAssistant.cs` holds the route, request, command, handler and validator, implementing `ICommand<T>` and `IRequireFeaturePermission` (`CoachFeatureRoutes.GameModel`, `ReadWrite`) with the same team-membership check as `UpdateGameModel`. Being a command keeps responses out of the query cache. Collaborators (context builder, envelope, proposal validator, options) live in `Features/Coaches/GameModels/Assistant/`, mirroring `Features/AiSettings/Services/`. The handler persists nothing and never logs the conversation or the context. When the caller has no active AI provider, `IAiChatCompletionService` returns `AiChatFailure.NoActiveProvider` before any adapter call; research found no existing HTTP mapping or error code for that failure (the only AI code is `AiProviderNotFound`), so the handler maps it to `409 Conflict` as `ProblemDetails` with a new code `AiNoActiveProvider` and the existing Spanish text from `AiChatFailureMessages`, and no request leaves the app. The disabled button in the page is only the interface half of the rule; the backend enforces it independently.

- **Provenance**: derived

### D6. The reply is validated in two layers with one shared retry

Layer one is the closed envelope schema (parser rejects unknown members, unknown operations and wrong types). Layer two is `GameModelProposalValidator` against the loaded model. The provider is called at most twice per request: one retry covers a schema failure and also a `question` reply when the maximum rounds are already reached. Two failures return `GameModelAssistantInvalidReply`. When the provider supports it the schema is also sent as forced JSON output; otherwise the schema is only in the system prompt.

- **Record family**: adr
- **Provenance**: derived
- Alternatives considered: unlimited retries (cost and latency for a paid key), repairing the JSON locally (hides provider faults). Rationale: the specs fix one retry; folding the rounds rule into it keeps the call budget bounded.

### D7. Forced JSON output is added to the provider layer behind a capability flag

`AiChatRequest` gains `ResponseSchema` (null by default). `IAiChatAdapter` gains `SupportsForcedJsonSchema`; only the adapter for the provider type that documents `response_format: json_schema` sets it true, and its body includes the field only when the request carries a schema. `MaxOutputTokens` is passed explicitly because the default of 1024 truncates a proposal. Null fields stay omitted, so existing adapter tests that assert properties keep passing.

- **Provenance**: codebase-forced

### D8. Rounds, size and window settings come from configuration

`GameModelAssistantOptions` is bound from section `GameModelAssistant` and read through `IOptionsMonitor` so a changed value applies to the next conversation without a code change. `MaxClarifyingRounds` defaults to 2. The context limit is `MaxContextCharacters`, a conservative character budget (the code has no per-model token limit); a larger context fails with `GameModelAssistantContextTooLarge` and is never truncated.

- **Provenance**: derived

### D9. Changes use temporary ids to express dependencies, and at most one change per target node

Each change has an `id` unique in the reply. An add under a node that another add creates carries `parentChangeId` instead of `parentAddress`. The validator processes changes in order: it keeps the first change per `address` (change and remove), discards a change whose address is missing from the model, whose fields break the existing rules (`Habilidad.Vocabulary`, `SetPieceRule.Subtypes`, `Nota.Tipos`, lengths, one note anchor), or whose `parentChangeId` points to a discarded or later change, and counts every discard in `discardedCount`. Adds are not deduplicated, since several adds may share a parent. The reply's `version` is the model marker read when the context was built.

- **Provenance**: derived

### D10. The front end keeps assistant state in a hook and applies changes with a pure module

`useGameModelAssistant` owns messages, the pending proposal, per-change status, and the proposal `version`. `gameModelProposalTree.ts` has pure functions: `applyChange(tree, change)`, `rejectWithDependents`, `canAccept` and `discardOrphans`. Accepting applies the change to the local copy of the tree held by `GameModel.tsx`; a "Guardar cambios del asistente" action sends the full tree once through `gameModelService.update` with `expectedVersion` set to the proposal version. A `GameModelStale` response reloads the model, clears the proposal and shows a snackbar asking to regenerate. Notices (discarded count, orphaned pending changes, errors) use the `rffm.show_snackbar` event. Closing the panel discards the conversation and pending changes; accepted but unsaved changes remain in the local tree until saved or discarded with it.

- **Provenance**: derived

### D11. The panel is a responsive drawer

The chat is a MUI `Drawer` (full width on small screens, side panel on large) in a CSS module, opened from a toolbar button on `GameModel.tsx`. The button is shown only when `canEdit`, and is disabled when `getAiProviders` returns no active provider, with a notice linking to the "Ajustes de IA" route. The panel shows the data-categories notice permanently.

- **Provenance**: derived

## Risks / Trade-offs

- [Node address format is computed on the front end (`gameModelNodeAddress.ts`) and must also be produced by the backend context and validator] (**Verify-first**: Step 4) → Mitigation: a backend `GameModelNodeAddresses` helper is checked against the front-end rules with the same literal examples on both sides; the context sends each node's address so the provider only echoes addresses it was given.
- [The pending-change type may hold one add per parent] (**Verify-first**: Step 12) → Mitigation: extend `PendingChanges` to a list of adds per parent with `changeId` before building cards.
- [Extracting `PlayerConditionService` from `GetTeamPlayerStatistics` touches a large handler] (**Verify-first**: Step 8) → Mitigation: extract with the existing tests as the safety net; if the extraction is not clean, send fatigue only, computed by `PlayerFatigueCalculator` directly.
- [The seasonal simulator may not be reusable outside `GetRivalSimulation`] (**Verify-first**: Step 8) → Mitigation: extract its call into a small service; when it cannot run, the forecast section is sent as absent and the assistant says so.
- [Every call spends the coach's own paid provider key and the endpoint has no per-user rate limit] → Mitigation: each call is bounded by `MaxMessages`, `MaxMessageLength`, `MaxContextCharacters` and `MaxOutputTokens`, and by at most two provider calls (one retry); the key owner is the caller, so no other user's key is spent. Per-user rate limiting is a non-goal (see Goals / Non-Goals).
- [Logging of the conversation or context] → Mitigation: `LoggingBehavior` logs request type names only (verified), so no exclusion is needed; the handler and builder log no conversation or context content.
- [Prompt-only schema enforcement can fail more often on weaker providers] → Mitigation: one retry, a clear error, and a model left unchanged; forced output where supported.
- [Health data (injury type, dates, condition) leaves the app] → Mitigation: allowlist by construction, no injury descriptions, a visible notice in the chat, and no logging of the context.
- [Concurrent saves] → Mitigation: the marker is an EF concurrency token, so a race fails with `GameModelStale` instead of overwriting.
- [Other write paths may change the game model without bumping the marker: `CreateGameModel`, `UpdateGameModel`, `DeleteGameModel` and `AdnLegibleImporter` touch the aggregate] (**Verify-first**: Step 2) → Mitigation: Step 1 sets the initial marker on creation paths and calls `Touch()` in `UpdateGameModel`; delete needs no marker.

## Migration Plan

1. Deploy the backend first: the migration adds `Version` and back-fills existing rows with generated values. The `expectedVersion` field is optional, so the current front end keeps working.
2. Deploy the front end after it. Until then no one can reach the assistant endpoint.
3. Rollback: remove the front end build, then revert the migration (drop the `Version` column). The migration is in its own commit, separate from application code.

## Open Questions

None blocking. The default clarifying rounds (2) is decided in D8, the context sources in D4, and the "Ajustes de IA" notice is recorded as out of scope.

## Manual Verification

- Generated artifact drift: after the migration, `AppDbContextModelSnapshot` contains `Version` on `GameModel` and the migration SQL back-fills existing rows (apply to a database that already has a game model and read it twice; both reads return the same `version`).
- End-to-end smoke with a real provider key: open the game-model page as a coach with write permission, send an ambiguous request and receive a question, answer it, receive a proposal, accept one card and reject another, save, and confirm the saved model holds only the accepted change; then edit the model in a second session before saving a new proposal and confirm the save is refused with the regenerate message.
