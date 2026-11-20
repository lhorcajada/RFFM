# Code Review — Game Model AI Assistant

**Reviewed:** `b9968c6e` 63c86d2b..48ec0169 · 2026-11-20

## Security Surface Triage

- **Surface touched:** Yes — new authenticated endpoint (`POST /api/game-models/{gameModelId}/assistant`) guarded by feature permission and team membership, deserialization of untrusted provider output (`GameModelAssistantEnvelope`), outbound health data (injury type and dates, physical condition) to the coach's own AI provider, and a new optimistic-concurrency token on update.

---

## Performance Surface Triage

- **Surface touched:** Yes — new hot-path handler with up to two paid provider calls per request, new EF queries in the context builder (sessions, players, injuries, conditions, season simulation on each turn), and a refactor of `GetTeamPlayerStatistics` and `GetRivalSimulation` onto extracted services.

---

## Accessibility Surface Triage

- **Surface touched:** Yes — new MUI `Drawer` chat panel, accept and reject card actions in the read view, a toolbar button with disabled state and a notice link, and new CSS modules.

---

## Findings

### Critical

#### C1 — No proposal card can be accepted against the real backend: `null` optional fields are treated as present
- **Location:** `Front/src/apps/coach/pages/game-model/components/gameModelProposalTree.ts:355-360` (`canAccept`), `Front/src/apps/coach/pages/game-model/components/gameModelProposalTree.ts:388-395` (`isOrphan`), `Front/src/apps/coach/pages/game-model/components/gameModelAssistantPending.ts:26-31` (`parentAddressOf`), `Front/src/apps/coach/services/gameModelService.ts:92-100` (`AssistantChange`)
- **Problem:** The backend reply DTO `AssistantChangeDto(string Id, string Operation, string NodeType, string? Address, string? ParentAddress, string? ParentChangeId, ...)` (`Back/ExtractionApi/src/RFFM.Api/Features/Coaches/GameModels/Commands/ChatWithGameModelAssistant.cs:63-70`) is returned with `Results.Ok(reply)` under the default ASP.NET Core web JSON options; no `DefaultIgnoreCondition = WhenWritingNull` is configured for HTTP responses (the only one is the private adapter request serializer in `AiChatAdapters.cs:17-21`). So every change arrives with `"parentChangeId": null`, and change/remove arrive with `"parentAddress": null`. The front types these as optional (`parentChangeId?: string`) and compares with `!== undefined`:
  - `canAccept`: `if (change.parentChangeId === undefined) return true;` is false for `null`, the parent lookup finds nothing, and it returns `false` for every change. `GameModelReadingNode.tsx:122` then renders every accept button disabled (`disabled={node.pending?.canAccept === false}`), so the coach cannot accept any card.
  - `isOrphan`: `change.parentAddress !== undefined && !addresses.has(change.parentAddress)` and `change.parentChangeId !== undefined` are true for `null`, so `discardOrphans` would drop every pending add.
  - `parentAddressOf` returns `null` for a dependent add instead of walking to its parent.
  This breaks the specs "Cards are accepted or rejected independently", "A dependent change follows its parent" and "Accepted changes are saved in one save". Every front test builds changes with the fields omitted (for example `gameModelProposalTree.test.ts:45-56`, `useGameModelAssistant.test.tsx:45`), so the suite is green while production is broken.
- **Suggested fix:** (1) Normalize at the service boundary: in `gameModelService.assistant`, map each change so `null` becomes `undefined` (or drop the key), and type the wire shape as `string | null`. This keeps the pure modules unchanged. (2) Alternatively, compare with `== null` / `!= null` in `gameModelProposalTree.ts` and `gameModelAssistantPending.ts`. (3) Or annotate the backend DTO members with `[JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]`; this fixes the wire but leaves the front fragile. In all cases add a test that feeds a reply with explicit `null` fields through `canAccept`, `discardOrphans` and `assistantPendingChanges`.

### High

None.

### Medium

None.

### Low

#### L8 — The statistics handler now loads match-like convocations twice (EXCLUDED: bounded extra query for one team; changing the service overload risks the statistics handler; the performance audit covers it)
- **Location:** `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Players/Queries/GetTeamPlayerStatistics.cs:363-384`, `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Players/Services/PlayerConditionService.cs`
- **Problem:** After extracting `PlayerConditionService`, the handler still runs its own `matchLikeConvocations` query (line 363, used for absences at 369 and 461) and then calls `conditionService.GetForTeamAsync` (line 384), which loads the same convocation data again for fatigue and readiness. Each statistics request now pays the query twice; the data is one team's season, so the cost is bounded. The dedicated performance audit covers the rest.
- **Suggested fix:** Let the service accept the already-loaded convocations (an overload), or return them together with the conditions so the handler reuses one load.

#### L1 — The identifying-data test checks the full name only as one combined string
- **Location:** `Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/GameModelAssistantContextBuilderTests.cs:164-169`
- **Problem:** The player is seeded with `Name = "Juan"` and `LastName = "Perez Lopez"` (`:75-76`), but the test asserts `Assert.DoesNotContain(FullName, context.Text)` for the combined value only. A leak of the first name or the last name alone would pass. The spec asks the test to assert that the full name is absent.
- **Suggested fix:** Also assert that the first name and the last name are absent, each on its own.

#### L2 — All injuries of each player are sent, with no date window
- **Location:** `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/GameModels/Assistant/GameModelAssistantContextBuilder.cs:137-141`
- **Problem:** Injuries are selected for every active team player with no date filter, while sessions are bounded by `SessionWindowDays`. Old health data goes to the provider and counts against `MaxContextCharacters`.
- **Suggested fix:** Keep only open injuries and those that ended inside the session window, or add a dedicated option.

#### L3 — The fallback player label is not stable between turns
- **Location:** `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/GameModels/Assistant/GameModelAssistantContextBuilder.cs:154-161`
- **Problem:** A player without an alias is labelled `$"Jugador {index + 1}"`, where `index` is the position in the result of `conditions.GetForTeamAsync`, which has no explicit order. The same player can get another label on the next turn of the same conversation, so earlier assistant messages can refer to the wrong player.
- **Suggested fix:** Order the players deterministically (for example by team player id) before numbering them.

#### L4 — Optional service parameters hide missing DI registrations (EXCLUDED: deliberate choice so other tests that build these handlers keep compiling; the services are registered and covered by tests)
- **Location:** `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Players/Queries/GetTeamPlayerStatistics.cs:186`, `:384`
- **Problem:** `Handler(AppDbContext db, PlayerConditionService? conditionService = null)` falls back to `new PlayerConditionService(db)`. A missing registration is never detected, and the handler builds its own instance outside DI. The same pattern is used for the forecast service in `GetRivalSimulation.cs`.
- **Suggested fix:** Make the service a required constructor parameter and build it explicitly in the tests.

#### L5 — `SupportsForcedJsonSchema` is declared but never read (EXCLUDED: the flag is part of the approved plan interface, harmless, and Q3 may decide how it is used)
- **Location:** `Back/ExtractionApi/src/RFFM.Api/Features/AiSettings/Services/AiChat.cs:70`, `Back/ExtractionApi/src/RFFM.Api/Features/AiSettings/Services/AiChatAdapters.cs:29`, `:113`
- **Problem:** No code consults the flag: the handler always sets `ResponseSchema`, the OpenAI-compatible adapter always sends it, and the Claude adapter ignores it. The flag is dead code that suggests a branch that does not exist.
- **Suggested fix:** Remove the flag, or use it in the handler to decide whether to send the schema, and cover that with a test.

#### L6 — Version marker tests miss two paths
- **Location:** `Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/UpdateGameModelHandlerTests.cs` (stale-rejection test), `Back/ExtractionApi/src/RFFM.Api/Infrastructure/GameModelImport/AdnLegibleImporter.cs` (`Touch()` call)
- **Problem:** The stale-rejection test asserts that the name is unchanged but not that the stored `Version` is unchanged. The `Touch()` added to the importer has no test, so removing it fails nothing.
- **Suggested fix:** Assert the stored version after a refused update, and add a re-import test that checks the version changes.

#### L7 — The `pending:{id}` key format is defined twice
- **Location:** `Front/src/apps/coach/pages/game-model/components/gameModelProposalTree.ts:31`, `Front/src/apps/coach/pages/game-model/components/gameModelAssistantPending.ts:5-6`
- **Problem:** `pendingKey` and `proposedAddAddress` build the same placeholder key on their own. The comment in `gameModelAssistantPending.ts:4` says it must match the key the proposal tree gives the new node. A change to one breaks accepting dependents silently.
- **Suggested fix:** Export one helper from `gameModelProposalTree.ts` and reuse it.

### Questions

#### Q1 — A malformed `expectedVersion` answers 409 instead of 400
- **Location:** `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/GameModels/Commands/UpdateGameModel.cs:101-104`
- **Question:** Any non-null `expectedVersion` that is not the current marker (including an empty or non-Guid string) returns `409 GameModelStale`. Should the validator reject a malformed value with `400` instead? The spec defines only the stale case.

#### Q2 — A new proposal after accepted but unsaved changes
- **Location:** `Front/src/apps/coach/pages/game-model/hooks/useGameModelAssistant.ts:84-93`
- **Question:** When the coach accepts some cards and then asks for a new proposal without saving, the backend builds the context and validates against the saved model, not the local tree. The new reply replaces the pending list and `proposalVersion`, while the accepted changes stay in the local tree, and the reply cannot address the nodes those changes added. Should the panel require a save (or a discard) before the next request, or is this acceptable?

#### Q3 — Forced JSON schema for every OpenAI-compatible endpoint
- **Location:** `Back/ExtractionApi/src/RFFM.Api/Features/AiSettings/Services/AiChatAdapters.cs:113-139`
- **Question:** `OpenAiCompatibleChatAdapter` always sends `response_format: { type: "json_schema", ... }` when a schema is supplied. Design D7 enables the flag for "the provider type that documents `response_format: json_schema`", but this adapter serves any OpenAI-compatible base URL, and some compatible servers reject `json_schema` with 400. That would turn every assistant call into `AiProviderFailed`. Should compatible endpoints fall back to the prompt-only schema on that error, or is the risk accepted?

---

Summary: Critical=1 High=0 Medium=0 Low=8 Questions=3
