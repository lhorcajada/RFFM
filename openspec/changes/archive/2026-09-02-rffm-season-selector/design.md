# Design — RFFM Season Selector

## 1. Backend

### 1.1 Config: single source of truth for the default season

New `RffmOptions` (bound from `appsettings.json` section `Rffm`, `services.Configure<RffmOptions>(configuration.GetSection("Rffm"))`):

```csharp
public class RffmOptions
{
    public int CurrentSeasonId { get; set; } = 22; // 2026-2027
    public List<RffmSeasonOption> SelectableSeasons { get; set; } =
    [
        new(22, "2026-2027"),
        new(21, "2025-2026"),
        new(20, "2024-2025"),
    ];
}

public record RffmSeasonOption(int Id, string Label);
```

`appsettings.Development.json` gets a `"Rffm": { "CurrentSeasonId": 22 }` entry; `SelectableSeasons`
keeps the C# default unless overridden. Every place that today hardcodes `21`/`"21"` reads
`IOptions<RffmOptions>.Value.CurrentSeasonId` instead. This is the *only* place the literal changes
when RFFM opens a new season.

### 1.2 Thread `temporada` through existing services

- `ClubDirectoryService.SearchAsync(string? search, string? codclub, int? temporada, ...)` —
  `BuildUrl` appends `&temporada={temporada}` to `https://www.rffm.es/competicion/clubes`.
- `ClubDirectoryService.GetClubTeamsAsync(string clubCode, int? temporada, ...)` — append
  `?temporada={temporada}` to the `fichaclub` URL. **Verify during implementation** whether RFFM's
  `fichaclub` page actually honors `temporada`; if the page ignores it, keep sending it anyway (no
  harm) but rely on the `CompetitionService.GetCompetitionsAsync(temporada)` join (below) to filter
  competitions by the requested season — document the finding as a code comment, don't silently drop
  the parameter.
- `CompetitionService.GetCompetitionsAsync(int? temporada = null, ...)` — replace the literal
  `temporada=21` with `temporada ?? _rffmOptions.Value.CurrentSeasonId`.
- `GetActa.cs` — replace default parameter `int temporada = 21` with a value resolved from
  `IOptions<RffmOptions>` at the endpoint delegate (minimal API can't default a route parameter from
  DI, so: `int? temporada` in the signature, resolve `temporada ?? options.Value.CurrentSeasonId`
  inside the handler).
- `GetPlayer.cs` — same pattern: `seasonId ?? options.Value.CurrentSeasonId.ToString()`.
- `GetTeamCallups.cs` — the `else 0` fallback (when `request.SeasonId` doesn't parse) becomes
  `else options.Value.CurrentSeasonId`.
- `SearchClubs.cs` / `GetClubTeams.cs` (route modules) — add `int? temporada` query parameter,
  forward to the service calls above. Cache keys (`clubs_search_...`, `clubs_{code}_teams`) must
  include the resolved `temporada` so different seasons don't share a cache entry.

### 1.3 New feature: `Features/Federation/Seasons/`

Follows the `Federation/Settings` vertical-slice shape.

**`Domain/Entities/Federation/RffmSeasonPreference.cs`** (schema `federation`, one row per user):

```csharp
public class RffmSeasonPreference : BaseEntity
{
    public string UserId { get; private set; }
    public int SeasonId { get; private set; }

    private RffmSeasonPreference() { }

    public RffmSeasonPreference(string userId, int seasonId)
    {
        UserId = userId;
        SeasonId = seasonId;
    }

    public void UpdateSeason(int seasonId) => SeasonId = seasonId;
}
```

EF configuration: unique index on `UserId` (one preference per user) — mirrors
`FederationSettingEntityConfiguration` but with `HasIndex(x => x.UserId).IsUnique()`.

**`Queries/GetRffmSeasons.cs`** — `GET /rffm/seasons` (`RequireAuthorization()`):
reads `IOptions<RffmOptions>` for `CurrentSeasonId` + `SelectableSeasons`, and (if a user id claim
is present) the caller's `RffmSeasonPreference` via a new `IRffmSeasonPreferenceService`. Response:

```csharp
public record RffmSeasonsResponse(int CurrentSeasonId, int? PreferredSeasonId, RffmSeasonOption[] Seasons);
```

**`Commands/SaveRffmSeasonPreference.cs`** — `PUT /rffm/season-preference`
(`RequireAuthorization()`), body `{ SeasonId: int }`, upserts (create if missing, else
`UpdateSeason`) via `IRffmSeasonPreferenceService`, returns `204 NoContent`.

**`Services/RffmSeasonPreferenceService.cs`** — `IRffmSeasonPreferenceService` with
`GetForUserAsync(userId)` / `UpsertAsync(userId, seasonId)`, backed by `FederationDbContext`. Add
`DbSet<RffmSeasonPreference> RffmSeasonPreferences` to `FederationDbContext`.

### 1.4 Migration

From `Back/ExtractionApi`:
`.\manage-migrations.ps1 -Context FederationDbContext -MigrationName AddRffmSeasonPreference`
(add action, following the script's existing `-Context FederationDbContext` support used for
`FederationSettings`). Output lands in `Infrastructure/Migrations/Federation/`.

## 2. Frontend

### 2.1 Shared season context + selector

`Front/src/shared/services/rffmSeasonService.ts` — `getRffmSeasons()` (`GET /rffm/seasons`),
`saveRffmSeasonPreference(seasonId: number)` (`PUT /rffm/season-preference`).

`Front/src/shared/context/RffmSeasonContext.tsx` — `RffmSeasonProvider` loads
`getRffmSeasons()` once on mount, seeds `seasonId` from `preferredSeasonId ?? currentSeasonId`,
exposes `{ seasonId, seasons, setSeasonId }` via `useRffmSeason()`; `setSeasonId` updates local state
immediately (optimistic) and fires `saveRffmSeasonPreference` in the background (fire-and-forget,
matching the existing `settingsService` error-toast pattern — see `Settings.tsx`'s
`saveCombination`). Mounted once, above both `<ThemeProvider>` trees (same level as `UserContext`),
since both Federation and Coach authenticate as the same backend user (`client.ts` reads a single
`coachAuthToken`).

`Front/src/shared/components/ui/RffmSeasonSelector/RffmSeasonSelector.tsx` + co-located CSS Module
— thin `<Select>` reading/writing `useRffmSeason()`, `size="small"`, matches existing MUI selector
components (`CompetitionSelector`, `GroupSelector`) for visual consistency.

### 2.2 Call-site changes

- `ClubSearchSection.tsx` — reads `useRffmSeason().seasonId`, passes it to
  `clubService.searchClubs(query, undefined, seasonId)` and
  `clubService.getClubTeams(club.clubCode, seasonId)` (extend `ClubService` methods with an
  optional `temporada` param). Render `<RffmSeasonSelector />` above the search row in
  `Settings.tsx`'s "O busca directamente por club" block.
- `Acta.tsx` — replace both hardcoded `"21"` with `useRffmSeason().seasonId`.
- `PlayerQuickViewDialog.tsx` — replace `effectiveSeasonId = seasonId ?? "21"` fallback with
  `seasonId ?? String(useRffmSeason().seasonId)`.
- `ClubPlayerSearch.tsx` (Coach) — this component already renders its own "Temporada" `<Select>`,
  but it's Coach's DB `Season` entity (used to gate which categories/teams are shown) — **not**
  replaced. Add `<RffmSeasonSelector />` as a second, clearly-labeled control ("Temporada RFFM")
  next to it, and pass its value to `federationClubService.getClubTeams(clubCode, rffmSeasonId)`.

## 3. Non-goals / risks

- Not merging Coach's `Season` entity with the RFFM season code — different lifecycles, different
  owners (per `proposal.md`).
- RFFM's actual support for `temporada` on `/fichaclub/{code}` and `/competicion/clubes` is assumed
  from the pattern used by `/acta-partido` and `/fichajugador`, but must be verified against the
  live site during implementation (§1.2 note) — if unsupported, the parameter becomes a no-op there
  and the season still narrows results via the `CompetitionService` join.
