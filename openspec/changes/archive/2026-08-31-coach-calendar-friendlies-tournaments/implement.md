# Implement: coach-calendar-friendlies-tournaments (Backend only)

Self-contained execution script. Read `proposal.md`, `design.md`, `specs/coach-calendar-match-categories/spec.md`
and `tasks.md` in this change directory first if anything below is ambiguous — they are the source
of truth for intent; this file is the precise mechanical script.

Repo root: `C:\Proyects\MisProyectos\FutbolBase`. Backend root: `Back/ExtractionApi`. Follow TDD:
write/extend a test, run it, confirm it fails for the right reason, then write the minimal
production code, then rerun.

## 1. MatchCategory on GetSportEvents

File: `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/SportEvents/Queries/GetSportEvents.cs`

### 1.1 (RED) Tests
Add to `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/GetSportEventsHandlerTests.cs` (same file,
same class, following its existing `SeedSportEventAsync` pattern — note that helper currently
hardcodes `EventTypeId=2`; add a new private overload/parameter so tests can seed a specific
`EventTypeId`, e.g. change its signature to
`SeedSportEventAsync(AppDbContext db, bool withConvocation, int eventTypeId = 2)` and pass
`eventTypeId` into `SportEvent.CreateNew(..., eventTypeId, team.Id, null)` — update existing two
call sites to keep passing `withConvocation` only, relying on the new default `2`).

Add four new `[Fact]` tests:
- `Handle_LeagueMatchEvent_ReturnsMatchCategoryLeague` — seed with `eventTypeId: 1`, assert
  `response.MatchCategory == "League"`.
- `Handle_FriendlyMatchEvent_ReturnsMatchCategoryFriendly` — seed with `eventTypeId: 4`, assert
  `"Friendly"`.
- `Handle_TournamentEvent_ReturnsMatchCategoryTournament` — seed with `eventTypeId: 6`, assert
  `"Tournament"`.
- `Handle_TrainingEvent_ReturnsMatchCategoryNull` — seed with default `eventTypeId: 2`, assert
  `Assert.Null(response.MatchCategory)`.

Run: `dotnet test --filter "FullyQualifiedName~GetSportEventsHandlerTests"` from
`Back/ExtractionApi`. All four new tests must fail (compile error is fine — `MatchCategory` doesn't
exist yet — that counts as Red here since the property is the thing under test).

### 1.2 (GREEN) Implementation
In `GetSportEvents.cs`:
- Add to `SportEventResponse`: `public string? MatchCategory { get; set; }`
- In `GetSportEventsRequestHandler.Handle`'s `.Select(sportEvent => new SportEventResponse { ... })`
  projection, add:
  ```csharp
  MatchCategory = sportEvent.EventTypeId switch
  {
      1 => "League",
      4 => "Friendly",
      6 => "Tournament",
      _ => null
  },
  ```
  (Use the raw literals 1/4/6 to match `SportEventType`'s existing ids — do not introduce a new
  constants class; `SportEventsConstants.MatchEventTypeId` already exists for `1` and may be reused
  for that branch if you prefer, but 4/6 have no existing named constant, so plain literals with the
  inline comment `// Friendly` / `// Tournament` are acceptable and consistent with how
  `SportEventType.cs` itself hardcodes these same ids.)

### 1.3 Verify
`dotnet test --filter "FullyQualifiedName~GetSportEventsHandlerTests"` — all tests (new + existing
`Handle_EventWithConvocation_ReturnsHasConvokedPlayersTrue` /
`Handle_EventWithoutConvocation_ReturnsHasConvokedPlayersFalse`) green.

## 2. Generalize sync-calendar for Friendlies and Tournaments

File: `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/SportEvents/Commands/SyncCalendarFromFederation.cs`

### 2.1 (RED) Tests
Create `Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/SyncCalendarFromFederationTests.cs`,
following the host-bootstrap pattern in the sibling file
`CreateSportEventInlineRivalTests.cs` (same directory) — `HostBuilder` +
`.UseTestServer()`, `AddDbContext<AppDbContext>` pointed at `_fixture.ConnectionString`,
`AddEasyCaching(...UseInMemory(Cache.CacheDefaultName)...)`, `app.UseEndpoints(e => new
SyncCalendarFromFederation().AddRoutes(e))`. `SyncCalendarFromFederation`'s endpoint needs
`AppDbContext`, `IStorageService`, `IEasyCachingProviderFactory` — register a trivial fake
`IStorageService` (all methods no-op / return the input url unchanged; `DownloadAsync` returns
`null` so the handler's `try { download = ... } catch { }` around shield upload silently no-ops,
matching how the real handler already tolerates upload failures) rather than pulling in real
Supabase/local storage:
```csharp
private class NoopStorageService : IStorageService
{
    public Task<string> UploadAsync(string bucket, string filePath, IFormFile file, CancellationToken ct) => Task.FromResult(filePath);
    public Task<string> UploadBytesAsync(string bucket, string filePath, byte[] content, string contentType, CancellationToken ct) => Task.FromResult(filePath);
    public Task<bool> DeleteAsync(string bucket, string filePath, CancellationToken ct) => Task.FromResult(true);
    public Task<(byte[] Content, string ContentType)?> DownloadAsync(string url, CancellationToken ct) => Task.FromResult<(byte[], string)?>(null);
}
```
Register with `services.AddSingleton<IStorageService>(new NoopStorageService());`.

Seed a `Team` the same way `GetSportEventsHandlerTests.SeedSportEventAsync` /
`CreateSportEventInlineRivalTests.SeedTeamAsync` do (Club → Season → Team, `AppDbContext` from
`_fixture.CreateDbContext()`), no need to seed any `SportEvent` up front — the endpoint creates
the `Rival` and `SportEvent` rows itself.

Tests (all `[Fact]`, post JSON to `/api/sport-events/sync-calendar` via
`client.PostAsJsonAsync(url, requestObject)` where `requestObject` is a `SyncCalendarRequest`):

1. `Sync_MatchesOnly_UnchangedBehavior_CreatesThenUpdatesByCodActa` — call sync twice with the same
   single `Matches` item (`CodActa: "ACTA-1"`), assert first call `Created == 1, Updated == 0`,
   second call `Created == 0, Updated == 1`; query `db.SportEvents` afterwards and assert exactly
   one row exists for that team with `EventTypeId == 1`.
2. `Sync_FriendlyItem_CreatesSportEventWithFriendlyEventType` — call sync with a `Friendlies` array
   containing one item (no `Matches`, i.e. `Matches: Array.Empty<SyncMatchItem>()`), assert response
   `Created == 1`, and the single returned `Events[0].EventTypeId == 4`.
3. `Sync_FriendlyItem_CalledTwice_UpdatesInsteadOfDuplicating` — call sync twice with the identical
   `Friendlies` item (same rival name, same date); assert second call has `Updated == 1, Created ==
   0`; query `db.SportEvents.Where(e => e.TeamId == teamId && e.EventTypeId == 4)` and assert
   `.Count() == 1`.
4. `Sync_TournamentItem_CreatesSportEventWithTournamentEventType` — same as #2 but via
   `Tournaments`, assert `EventTypeId == 6`.
5. `Sync_TournamentItem_CalledTwice_UpdatesInsteadOfDuplicating` — same as #3 but via `Tournaments`,
   asserting on `EventTypeId == 6`.
6. `Sync_FriendlyAndLeagueMatch_SameTeamSameDate_DoNotCollide` — call sync once with one `Matches`
   item and one `Friendlies` item, both dated the same day for the same team; assert
   `Created == 2`; query `db.SportEvents.Where(e => e.TeamId == teamId)` and assert `.Count() == 2`
   (one `EventTypeId==1`, one `EventTypeId==4`).

Run: `dotnet test --filter "FullyQualifiedName~SyncCalendarFromFederationTests"`. Expect compile
failures (no `Friendlies`/`Tournaments` properties on `SyncCalendarRequest` yet) — that is the Red
state.

### 2.2 (GREEN) Implementation
In `SyncCalendarFromFederation.cs`:

1. Extend the request record:
   ```csharp
   public record SyncCalendarRequest(
       string TeamId,
       SyncMatchItem[] Matches,
       string? MyTeamShieldUrl,
       SyncMatchItem[]? Friendlies = null,
       SyncMatchItem[]? Tournaments = null
   );
   ```
2. Add an `EventTypeId` constant for the two new types alongside the existing
   `SportEventsConstants.MatchEventTypeId` — add to
   `Features/Coaches/SportEvents/Queries/SportEventsConstants.cs`:
   ```csharp
   /// <summary>SportEventType.Id for "Amistoso" (friendly match).</summary>
   public const int FriendlyEventTypeId = 4;
   /// <summary>SportEventType.Id for "Torneo" (tournament).</summary>
   public const int TournamentEventTypeId = 6;
   ```
3. Refactor the endpoint lambda: extract the body of the existing `foreach (var match in
   req.Matches)` loop (steps 1–5, i.e. rival resolve/create, shield download, find-or-create
   `SportEvent`, save) into a private `static async Task ProcessMatchItemsAsync(...)` (or keep it an
   inline local function inside the lambda if that's simpler given the closures needed — match the
   minimal-diff spirit of the existing file) taking the array of items and the target `eventTypeId`
   as parameters instead of hardcoding `req.Matches` and
   `SportEventsConstants.MatchEventTypeId`. Specifically the line:
   ```csharp
   e.EventTypeId == SportEventsConstants.MatchEventTypeId,
   ```
   becomes parameterized on `eventTypeId`, and `SportEvent.CreateNew(..., SportEventsConstants.MatchEventTypeId, ...)`
   likewise becomes `SportEvent.CreateNew(..., eventTypeId, ...)`. Keep `created`/`updated`/`failed`
   counters and `savedEvents` list shared/accumulated across all three invocations (pass them by
   reference, or have the extracted method return its own `(created, updated, failed,
   IEnumerable<SportEventSaveResponse>)` tuple and sum/concat at the call sites — whichever keeps
   the diff smallest and readable).
4. After processing `req.Matches` (unchanged call), add:
   ```csharp
   if (req.Friendlies is { Length: > 0 })
   {
       // process req.Friendlies with eventTypeId = SportEventsConstants.FriendlyEventTypeId
   }
   if (req.Tournaments is { Length: > 0 })
   {
       // process req.Tournaments with eventTypeId = SportEventsConstants.TournamentEventTypeId
   }
   ```
5. Do not change `SyncCalendarRequestValidator` beyond what's needed for it to keep validating
   `Matches`/each item the same way — optionally add the same `RuleForEach(...).ChildRules(...)`
   validation for `Friendlies`/`Tournaments` when non-null, mirroring the `Matches` rule (`RivalName`
   `NotEmpty().MaximumLength(100)`), using `When(x => x.Friendlies is not null, ...)` /
   `When(x => x.Tournaments is not null, ...)`. This endpoint currently has no validator wired into
   the lambda at all (unlike `CreateSportEvent`) — verify that by checking whether a
   `FluentValidation.IValidator<SyncCalendarRequest>` parameter is injected/called before making the
   validator change; if it isn't wired today, leave that as-is (out of scope) and only update the
   validator class definition for consistency, not its invocation.

### 2.3 Verify
`dotnet test --filter "FullyQualifiedName~SyncCalendarFromFederationTests"` green. Then run
`dotnet test --filter "FullyQualifiedName~CreateSportEventInlineRivalTests|FullyQualifiedName~SportEventsPushNotificationWiringTests"`
to confirm no regression in adjacent sport-events tests.

## 3. Final verification (run from `Back/ExtractionApi`)

- [ ] `dotnet build` — zero errors, no new warnings.
- [ ] `dotnet test` — full suite green, nothing skipped.
- [ ] `openspec validate coach-calendar-friendlies-tournaments --strict` (run from repo root) —
      passes.
- [ ] Do NOT run `git commit` / `git push` — the orchestrator/user handles commits.

## Report back

Summarize: files changed, new test file(s) added, full `dotnet test` result (pass count / fail
count), and the exact final shape of `SyncCalendarRequest` and `SportEventResponse.MatchCategory`
for the orchestrator to relay to the frontend team.
