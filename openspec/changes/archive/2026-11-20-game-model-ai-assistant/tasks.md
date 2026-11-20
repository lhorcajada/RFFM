## Step 1: Version marker on the game model aggregate

- [x] Step 1: Version marker on the game model aggregate

**Routing**: category=data Â· context=medium Â· difficulty=medium

**Files Affected**:
- M Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/GameModels/GameModel.cs
- M Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/Configuration/Aggregates/GameModels/GameModelConfiguration.cs
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/GameModels/Commands/UpdateGameModel.cs
- M Back/ExtractionApi/src/RFFM.Api/Infrastructure/Migrations/AppDbContextModelSnapshot.cs
- A Back/ExtractionApi/src/RFFM.Api/Infrastructure/Migrations/2026*_AddGameModelVersion.cs â€” generated count=1
- A Back/ExtractionApi/src/RFFM.Api/Infrastructure/Migrations/2026*_AddGameModelVersion.Designer.cs â€” generated count=1
- A Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/GameModelVersionTests.cs
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/UpdateGameModelHandlerTests.cs

**What Will Be Done**: Add a non-null `Version` Guid to `GameModel`, initialized in the constructor (so `CreateGameModel` and `AdnLegibleImporter` need no change) and replaced by a `Touch()` method that `UpdateGameModelHandler` calls on every save. Configure it as an EF concurrency token in `GameModelConfiguration`. Generate the migration with `manage-migrations.ps1` and edit it so existing rows are back-filled with generated Guids before the column becomes non-null. The test fixture applies migrations (`Database.MigrateAsync`), so the migration must ship in this same step. This step resolves the risk of write paths that skip the marker: it audits `CreateGameModel`, `UpdateGameModel`, `DeleteGameModel` and `AdnLegibleImporter`, the only writers found. Spec: `openspec/changes/game-model-ai-assistant/specs/game-model/spec.md` (marker changes on save).

**Testing Strategy**: Domain test: a new model has a non-empty marker and `Touch()` changes it. Integration test in the existing update tests: a save changes the stored marker. Reviewed existing tests `CreateGameModelHandlerTests.cs`, `GetGameModelHandlerTests.cs` and `UpdateGameModelHandlerTests.cs`; they construct models through the handlers and stay compatible with the extra column.

**Existing Tests Broken**: None

## Step 2: Return the marker on read and check it on update

- [x] Step 2: Return the marker on read and check it on update

**Routing**: category=backend Â· context=medium Â· difficulty=medium

**Files Affected**:
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/GameModels/Queries/GetGameModel.cs
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/GameModels/Commands/UpdateGameModel.cs
- M Back/ExtractionApi/src/RFFM.Api/Domain/ErrorCodes.cs
- M Back/ExtractionApi/src/RFFM.Api/DependencyInjection/ServiceCollectionExtensions.cs
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/GetGameModelHandlerTests.cs
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/UpdateGameModelHandlerTests.cs

**What Will Be Done**: Add `Version` to `GameModelResponse`. Add an optional trailing `ExpectedVersion` to the update request, compared right after the model is loaded and before `UpdateName`; on mismatch return `409 Conflict` as `ProblemDetails` with the new `GameModelStale` code, following the inline `Results.Conflict` pattern of `ApproveClubJoinRequest`. Map `DbUpdateConcurrencyException` for this aggregate to the same 409 in `AddCustomProblemDetails`, so a race behaves like a stale marker. Spec: `openspec/changes/game-model-ai-assistant/specs/game-model/spec.md`.

**Testing Strategy**: Integration tests for read returns the marker, repeated reads return the same marker, matching expected marker applies, stale marker returns 409 with the code and leaves the model unchanged, no expected marker behaves as before. Reviewed `GetGameModelHandlerTests.cs` and `UpdateGameModelHandlerTests.cs`: the new request member is optional and the response member is additive, so existing assertions remain compatible.

**Existing Tests Broken**: None

## Step 3: Backend node addresses

- [x] Step 3: Backend node addresses

**Routing**: category=backend Â· context=medium Â· difficulty=high

**Files Affected**:
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/GameModels/Assistant/GameModelNodeAddresses.cs
- A Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/GameModelNodeAddressesTests.cs

**What Will Be Done**: Read `Front/src/apps/coach/pages/game-model/components/gameModelNodeAddress.ts` and its test, then implement a backend helper that lists every addressable node of a loaded `GameModel` (key for principles, subprincipios, zones and sub-subprincipios; `hab:` and `nota:` suffixes under the parent address; `set-pieces/` for set-piece rules) with its node type and parent address. This step resolves the address-format risk before the validator and context builder rely on it. The helper is a pure function over the loaded aggregate; stable keys come from `GameModelKeys`.

**Testing Strategy**: Unit tests build a model and assert addresses against literal examples copied from the front-end address tests, so a divergence fails on one side. Spec: `openspec/changes/game-model-ai-assistant/specs/game-model-ai-proposals/spec.md` (cards on the affected node).

**Existing Tests Broken**: None

## Step 4: Reply envelope, schema and proposal validator

- [x] Step 4: Reply envelope, schema and proposal validator

**Routing**: category=backend Â· context=medium Â· difficulty=high

**Files Affected**:
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/GameModels/Assistant/GameModelAssistantEnvelope.cs
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/GameModels/Assistant/GameModelProposalValidator.cs
- A Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/GameModelAssistantEnvelopeTests.cs
- A Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/GameModelProposalValidatorTests.cs

**What Will Be Done**: Define the envelope records, the JSON schema text embedded in the prompt and sent as forced output, and a strict parser that rejects unknown members, operations, node types and wrong types. Implement `GameModelProposalValidator` as a pure function over the loaded model and the parsed envelope, using `GameModelNodeAddresses` and the existing domain rules (`Habilidad.Vocabulary`, `SetPieceRule.Subtypes`, `Nota.Tipos`, length limits, single note anchor). It keeps the first change per address, resolves `parentChangeId` in order, cascades the discard of dependents, and returns the valid changes plus the discarded count. Specs: `openspec/changes/game-model-ai-assistant/specs/game-model-ai-assistant/spec.md` (typed envelope) and `openspec/changes/game-model-ai-assistant/specs/game-model-ai-proposals/spec.md` (validation, one change per node).

**Testing Strategy**: Unit tests per rule, failing cases first: unknown member, missing node, bad Habilidad name, duplicate address, dependent of a discarded add, discard counts (two of five discarded gives three changes), valid reply. Fixtures are plain in-memory models.

**Existing Tests Broken**: None

## Step 5: Forced JSON schema in the provider layer

- [x] Step 5: Forced JSON schema in the provider layer

**Routing**: category=backend Â· context=medium Â· difficulty=medium

**Files Affected**:
- M Back/ExtractionApi/src/RFFM.Api/Features/AiSettings/Services/AiChat.cs
- M Back/ExtractionApi/src/RFFM.Api/Features/AiSettings/Services/AiChatAdapters.cs
- M Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/AiChatAdaptersTests.cs

**What Will Be Done**: Add an optional `ResponseSchema` to `AiChatRequest` and a `SupportsForcedJsonSchema` member to `IAiChatAdapter`. The OpenAI-compatible adapter for the provider type that documents `response_format: json_schema` reports true and adds the field to its body only when the request carries a schema; the Claude adapter reports false. Keep null fields omitted by `RequestJson`. Spec: `openspec/changes/game-model-ai-assistant/specs/game-model-ai-assistant/spec.md`.

**Testing Strategy**: Adapter tests assert the body contains the schema field only when set and that adapters without support ignore it. Reviewed `AiChatAdaptersTests.cs` (asserts properties, not whole bodies) and the adapter implementations in `AiChatAdapters.cs`: the new member is implemented by every adapter in the same step, so nothing is left unimplemented.

**Existing Tests Broken**: None

## Step 6: Player condition service

- [x] Step 6: Player condition service

**Routing**: category=backend Â· context=large Â· difficulty=high

**Files Affected**:
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Players/Services/PlayerConditionService.cs
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Players/Queries/GetTeamPlayerStatistics.cs
- A Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/PlayerConditionServiceTests.cs
- M Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/GetTeamPlayerStatisticsHandlerTests.cs

**What Will Be Done**: Extract the per-player fatigue, readiness and form computation from `GetTeamPlayerStatistics` (fatigue around lines 527-529, readiness 489) into `PlayerConditionService`, which takes a team and returns condition per player without the `Squad` permission check. The handler delegates to it and keeps its response unchanged. If the extraction cannot be done cleanly, the service returns fatigue only, computed with `PlayerFatigueCalculator`, and the design risk is closed that way. Spec: `openspec/changes/game-model-ai-assistant/specs/game-model-ai-assistant/spec.md` (physical condition in the context).

**Testing Strategy**: Unit tests for the service with fixed dates; the existing statistics tests act as the regression net for the handler. Reviewed `GetTeamPlayerStatisticsHandlerTests.cs` and `PlayerFatigueCalculatorTests.cs`: the handler constructor gains the service, so handler tests need adaptation; the calculator tests stay compatible.

**Existing Tests Broken**:
- `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/GetTeamPlayerStatisticsHandlerTests.cs` â€” compile

## Step 7: Own-team forecast service

- [x] Step 7: Own-team forecast service

**Routing**: category=backend Â· context=medium Â· difficulty=medium

**Files Affected**:
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/MatchForecast/Services/OwnTeamForecastService.cs
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/MatchForecast/GetRivalSimulation.cs
- A Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/OwnTeamForecastServiceTests.cs
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/RivalSimulationTests.cs

**What Will Be Done**: Move the call sequence of `GetRivalSimulation` (`RivalSimulationInputLoader` at line 61, `SeasonSimulator.Run` at line 64) into `OwnTeamForecastService`, returning the own team's pending-match predictions and projected position, or an absent result when federation data is missing. The handler delegates to it with an unchanged response. This step resolves the question of whether the simulator can run outside the rival-simulation endpoint. Spec: `openspec/changes/game-model-ai-assistant/specs/game-model-ai-assistant/spec.md`.

**Testing Strategy**: Unit tests for the absent-data case and a normal case with a stubbed loader result. Reviewed `RivalSimulationTests.cs` and `SeasonSimulatorTests.cs`: the handler constructor changes, so the integration test needs adaptation; the simulator tests stay compatible because the simulator is untouched.

**Existing Tests Broken**:
- `Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/RivalSimulationTests.cs` â€” compile

## Step 8: Allowlisted context builder and assistant options

- [x] Step 8: Allowlisted context builder and assistant options

**Routing**: category=backend Â· context=large Â· difficulty=high

**Files Affected**:
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/GameModels/Assistant/GameModelAssistantOptions.cs
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/GameModels/Assistant/GameModelAssistantContextBuilder.cs
- M Back/ExtractionApi/src/RFFM.Api/DependencyInjection/ServiceCollectionExtensions.cs
- M Back/ExtractionApi/src/RFFM.Host/appsettings.json
- A Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/GameModelAssistantContextBuilderTests.cs

**What Will Be Done**: Add `GameModelAssistantOptions` bound from section `GameModelAssistant` (registered like `RffmOptions`, read through `IOptionsMonitor`) with defaults in `appsettings.json`. Implement the builder with dedicated allowlist records only: the model tree with node addresses, objective notes plus session objectives within the window, upcoming and recent sessions, forecast from `OwnTeamForecastService`, and active players by alias with injury type, dates and estimated recovery plus condition from `PlayerConditionService`. It serializes to the prompt text, throws a coded `DomainException` (`GameModelAssistantContextTooLarge`) when over `MaxContextCharacters`, and returns the model marker captured at build time. Spec: `openspec/changes/game-model-ai-assistant/specs/game-model-ai-assistant/spec.md` (allowlist, oversized context).

**Testing Strategy**: Integration test on the Postgres fixture with a player that has DNI, phone, email, full name and an injury description naming a person; assert none of those strings is in the serialized context and that injury type and dates are. Test the over-limit failure and that the returned marker equals the stored one.

**Existing Tests Broken**: None

## Step 9: Assistant endpoint

- [x] Step 9: Assistant endpoint

**Routing**: category=backend Â· context=large Â· difficulty=high

**Files Affected**:
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/GameModels/Commands/ChatWithGameModelAssistant.cs
- M Back/ExtractionApi/src/RFFM.Api/Domain/ErrorCodes.cs
- A Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/ChatWithGameModelAssistantHandlerTests.cs

**What Will Be Done**: One vertical-slice file with the route `POST /api/game-models/{gameModelId}/assistant`, the request, an `ICommand<T>`, its handler and its validator (`MaxMessages`, `MaxMessageLength`, last message from the user). The handler checks `ReadWrite` through `IRequireFeaturePermission` and team membership as `UpdateGameModel` does, builds the context, derives asked rounds from the messages, calls `IAiChatCompletionService` with the schema, parses, retries once for a schema failure or a question after the maximum rounds, runs `GameModelProposalValidator`, and returns kind, message, changes, discarded count and marker. Provider failures map to `ProblemDetails` with the `AiChatFailureMessages` text, and `AiChatFailure.NoActiveProvider` maps to `409` with the new code `AiNoActiveProvider` (no existing code covers it); two invalid replies return `GameModelAssistantInvalidReply`. It persists nothing and logs no conversation content. Specs: `openspec/changes/game-model-ai-assistant/specs/game-model-ai-assistant/spec.md` and `openspec/changes/game-model-ai-assistant/specs/game-model-ai-proposals/spec.md`.

**Testing Strategy**: Integration tests with a fake `IAiChatCompletionService`: forbidden for read-only users with no provider call, no active provider returns the 4xx code with no outbound call, question carries no changes, proposal with discards, invalid reply retried once, invalid twice, maximum rounds forcing a proposal, provider quota error, and nothing stored after the call.

**Existing Tests Broken**: None

## Step 10: Front service types and additive pending-change types

- [x] Step 10: Front service types and additive pending-change types

**Routing**: category=frontend-code Â· context=medium Â· difficulty=medium

**Files Affected**:
- M Front/src/apps/coach/services/gameModelService.ts
- M Front/src/apps/coach/pages/game-model/components/gameModelReadingTree.ts
- M Front/src/apps/coach/services/__tests__/gameModelService.test.ts
- M Front/src/apps/coach/pages/game-model/components/__tests__/gameModelReadingTree.test.ts

**What Will Be Done**: Add `version` to `ApiGameModel` and its mapper, an optional `expectedVersion` argument to `update`, the assistant request and response types, and an `assistant` call with `ProblemDetails` error handling. In `gameModelReadingTree.ts` read how `PendingChanges` holds adds and, if one add per parent is the limit, extend it additively (optional `changeId`, `canAccept`, and a list of adds per parent) without changing existing consumers. This step resolves the pending-change-type risk before the cards are built. Spec: `openspec/changes/game-model-ai-assistant/specs/game-model-ai-proposals/spec.md`.

**Testing Strategy**: Service tests for version mapping, `expectedVersion` in the request body, the assistant call, and a stale 409 error. Reading-tree tests for several adds under one parent and for `changeId` on decorations. Reviewed `gameModelReadingTree.test.ts`, `GameModelReadingView.test.tsx` and `GameModel.test.tsx`: all changes are additive, so they stay compatible.

**Existing Tests Broken**: None

## Step 11: Proposal tree module

- [x] Step 11: Proposal tree module

**Routing**: category=frontend-code Â· context=medium Â· difficulty=high

**Files Affected**:
- A Front/src/apps/coach/pages/game-model/components/gameModelProposalTree.ts
- A Front/src/apps/coach/pages/game-model/components/__tests__/gameModelProposalTree.test.ts

**What Will Be Done**: Pure functions over the tree types of `gameModelService.ts`: `applyChange` (add, change, remove for each node type, using the same address rules as `gameModelNodeAddress.ts`), `rejectWithDependents`, `canAccept` (parent accepted first), and `discardOrphans` (pending changes whose node no longer exists after an accepted removal). No React and no assistant state. Spec: `openspec/changes/game-model-ai-assistant/specs/game-model-ai-proposals/spec.md`.

**Testing Strategy**: Unit tests per rule: accept one of two, reject one, dependent before parent, parent rejected with two dependents, orphan discarded after an accepted removal, several accepted changes applied to one tree.

**Existing Tests Broken**: None

## Step 12: Cards with accept and reject in the read view

- [x] Step 12: Cards with accept and reject in the read view

**Routing**: category=frontend-ui Â· context=medium Â· difficulty=medium

**Files Affected**:
- M Front/src/apps/coach/pages/game-model/components/GameModelReadingView.tsx
- M Front/src/apps/coach/pages/game-model/components/GameModelReadingNode.tsx
- M Front/src/apps/coach/pages/game-model/components/__tests__/GameModelReadingView.test.tsx

**What Will Be Done**: Pass `onAcceptChange` and `onRejectChange` as optional props through `GameModelReadingView` and its reading context to the node components. Pending cards (`PlaceholderCard` for adds and the proposal block for changes and removes) show Aceptar and Rechazar actions, with Aceptar disabled when `canAccept` is false. The view keeps no assistant state. Cards stay responsive and use the existing CSS module. Spec: `openspec/changes/game-model-ai-assistant/specs/game-model-ai-proposals/spec.md` (one card per node).

**Testing Strategy**: Component tests: a card on the affected node shows the proposed text and both actions, an add shows in the placeholder, a dependent card has no available accept, and actions call the callbacks with the `changeId`. Reviewed `GameModelReadingView.test.tsx`: new props are optional, so existing cases stay compatible.

**Existing Tests Broken**: None

## Step 13: Assistant hook

- [x] Step 13: Assistant hook

**Routing**: category=frontend-code Â· context=medium Â· difficulty=high

**Files Affected**:
- A Front/src/apps/coach/pages/game-model/hooks/useGameModelAssistant.ts
- A Front/src/apps/coach/pages/game-model/hooks/__tests__/useGameModelAssistant.test.tsx

**What Will Be Done**: A hook that owns the messages, the pending proposal with per-change status, the proposal marker and loading and error state. Send appends the user message and calls `gameModelService.assistant` with the whole conversation; accept and reject use `gameModelProposalTree`, and accepting returns the new local tree to the caller. It reports the discarded count and orphan notices through the `rffm.show_snackbar` event, keeps the conversation on a provider error so the same request can be retried, and clears everything on close. Spec: `openspec/changes/game-model-ai-assistant/specs/game-model-ai-assistant/spec.md` (conversation held by the browser).

**Testing Strategy**: Hook tests with a mocked service: second message carries earlier messages, error keeps the conversation and retry resends it, close discards the proposal, discarded count notice.

**Existing Tests Broken**: None

## Step 14: Assistant panel and game-model page integration

- [x] Step 14: Assistant panel and game-model page integration

**Routing**: category=frontend-ui Â· context=large Â· difficulty=high

**Files Affected**:
- A Front/src/apps/coach/pages/game-model/components/GameModelAssistantPanel.tsx
- A Front/src/apps/coach/pages/game-model/components/GameModelAssistantPanel.module.css
- M Front/src/apps/coach/pages/game-model/GameModel.tsx
- A Front/src/apps/coach/pages/game-model/components/__tests__/GameModelAssistantPanel.test.tsx
- M Front/src/apps/coach/pages/game-model/__tests__/GameModel.test.tsx

**What Will Be Done**: A responsive MUI `Drawer` with the conversation, an input, the permanent data-categories notice and the error alerts. In `GameModel.tsx` add the toolbar button (only when `canEdit`), disabled with a link to the "Ajustes de IA" route when `getAiProviders` returns no active provider. Hold the local tree copy: accepted changes update it, and a "Guardar cambios del asistente" action saves once through `gameModelService.update` with the proposal marker as `expectedVersion`. On a `GameModelStale` error reload the model, clear the proposal and notify. Pass pending changes and the accept and reject callbacks to the reading view. Specs: both new capability specs under `openspec/changes/game-model-ai-assistant/specs/`.

**Testing Strategy**: Panel tests for the notice, send, question reply, proposal cards, provider error, and close discarding. Page tests: button hidden without write permission, disabled without an active provider with the settings link, accept two of three and save once with the full tree, failed save leaves the model unchanged, stale marker reloads and asks to regenerate. Reviewed `GameModel.test.tsx`: the page now loads providers, so its service mocks need extending.

**Existing Tests Broken**:
- `Front/src/apps/coach/pages/game-model/__tests__/GameModel.test.tsx` â€” runtime

## Required Documentation

### Spec files
- openspec/changes/game-model-ai-assistant/specs/game-model-ai-assistant/spec.md
- openspec/changes/game-model-ai-assistant/specs/game-model-ai-proposals/spec.md
- openspec/changes/game-model-ai-assistant/specs/game-model/spec.md
- openspec/specs/game-model/spec.md
- openspec/specs/game-model-reading-view/spec.md
- openspec/specs/ai-provider-settings/spec.md
- openspec/specs/ai-chat-completion/spec.md

### Local files
- openspec/changes/game-model-ai-assistant/proposal.md â€” motivation, scope, and the research documentation the design started from.
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/GameModels/Commands/UpdateGameModel.cs â€” full-tree upsert to extend with the marker check; permission and team-membership pattern.
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/GameModels/Queries/GetGameModel.cs â€” read response to extend with the marker.
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/ClubJoinRequests/Commands/ApproveClubJoinRequest.cs â€” pattern for an inline 409 ProblemDetails with a code.
- Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/GameModels/GameModel.cs â€” aggregate that gains the marker; sibling Habilidad, SetPieceRule and Nota hold the closed vocabularies.
- Back/ExtractionApi/src/RFFM.Api/Features/AiSettings/Services/AiChat.cs â€” chat request, result and failure types to extend.
- Back/ExtractionApi/src/RFFM.Api/Features/AiSettings/Services/AiChatAdapters.cs â€” adapters whose request bodies gain the optional schema.
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Players/Queries/GetTeamPlayerStatistics.cs â€” source of the condition computation to extract.
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/MatchForecast/GetRivalSimulation.cs â€” source of the forecast computation to extract.
- Back/ExtractionApi/src/RFFM.Api/Infrastructure/Options/RffmOptions.cs â€” options pattern to imitate for the assistant settings.
- Back/ExtractionApi/tests/RFFM.Api.Tests/Fixtures/PostgresContainerFixture.cs â€” Postgres test fixture that migrates the database; reusable for integration tests.
- Front/src/apps/coach/pages/game-model/GameModel.tsx â€” page to extend with the assistant button, local tree and save.
- Front/src/apps/coach/pages/game-model/components/gameModelReadingTree.ts â€” pending-change types and tree builder to extend additively.
- Front/src/apps/coach/pages/game-model/components/gameModelNodeAddress.ts â€” address rules the backend must mirror and the apply module must follow.
- Front/src/apps/coach/services/gameModelService.ts â€” service and tree types to extend with the marker and assistant call.
- Front/src/apps/coach/services/aiProviderService.ts â€” active-provider flag used to enable the assistant button.

### External URLs
None

## Implementation Context

**Stack**: Backend .NET 9, ASP.NET Core Minimal API, Mediator v3, EF Core 9 on PostgreSQL, FluentValidation v12, xUnit. Frontend React 19, TypeScript 5.5 strict, Vite 7, MUI v5, Axios, CSS Modules, Vitest with Testing Library.

**Conventions**:
- Backend features are vertical slices: one `.cs` file holds endpoint, request, command, handler and validator; every `ICommand` has a validator and errors are `ProblemDetails` with codes from `Domain/ErrorCodes.cs`.
- EF configurations live in `Infrastructure/Persistence/Configuration/Aggregates/...` and migrations in `Infrastructure/Migrations`, created with `manage-migrations.ps1`; backend integration tests use a Postgres test container that applies migrations.
- Front services are the only layer calling Axios; page-level components get styles from CSS Modules plus the MUI theme, with no tables, `any`, inline styles or barrel files.
- Cross-app notices use the `rffm.show_snackbar` window event; confirmations use `ConfirmDialog`, never `window.confirm`.
- Tests are named as full sentences, written before the production code, and run per area during development.

**Avoid**:
- Do not serialize entities or DTOs for the provider; only allowlist records.
- Do not log conversation or context content, and do not store the conversation anywhere.
- Do not add a second Axios instance, a store, or an assistant state inside the read view.
- Do not edit a migration that is already pushed; add a new one.

**Test Command**:
- Backend: `dotnet test Back/ExtractionApi/tests/RFFM.Api.Tests/RFFM.Api.Tests.csproj`; scoped: `dotnet test Back/ExtractionApi/tests/RFFM.Api.Tests/RFFM.Api.Tests.csproj --filter FullyQualifiedName~<TestName>`
- Frontend (run from `Front`): `npx vitest run --maxWorkers=4`; scoped: `npx vitest run <path-to-test-file>`
