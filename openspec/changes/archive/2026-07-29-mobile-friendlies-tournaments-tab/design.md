## Context

`Mobile/src/screens/CalendarScreen.tsx` lists every `SportEvent` returned by `GET /api/sport-events/{teamId}` (paginated, `descending: false`, optional `startDate`/`endDate`), resolving each `eventTypeId` to a name via `fetchSportEventTypeMap()` (`GET /api/sport-event-types`). `EventCard.tsx` already does ad-hoc substring matching on the resolved type name for its own styling concerns (`isMatch` for `'partido'`, `getHeaderStyle` for `'entrenamiento'` and `'torneo'`/`'competici'`). This change adds a new tab + screen that reuses the same two endpoints, filtered to a subset of event types, with no backend changes.

### Resolved decision: does a "Torneo" event type actually exist?

Checked against the real backend data (not assumed):

- `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/Assistances/SportEventType.cs` defines a fixed, closed list: `Partido`(1), `Entrenamiento`(2), `Reunión`(3), `Amistoso`(4), `Pruebas de acceso`(5).
- The seed data that actually lands in the `app.SportEventTypes` table, per `AppDbContextModelSnapshot.cs` (current model state, ids 1–5) and the original `InsertData` in `20260316173356_InitialCreate.cs`, matches exactly that list — **there is no `Torneo` or `Competición` row anywhere in the schema or seed data today.**
- `GetSportEventTypes.cs` (`Back/ExtractionApi/src/RFFM.Api/Features/Coaches/SportEventTypes/Queries/SportEventTypes.cs`) only reads `_db.SportEventTypes` — there is no create/seed-from-UI endpoint. It's a closed lookup table today; only a backend migration could add a `Torneo` row.

**Conclusion — no assumption needed, this is verified fact:** `"amistos"` (case-insensitive substring of `"Amistoso"`) is the only keyword that will ever match against current data. `"torneo"`/`"competici"` are already present as dead-but-harmless matches in `EventCard.tsx`'s `getHeaderStyle` (they never fire today either, for the same reason). Keeping the same two speculative keywords in the new classification helper costs nothing and makes the tab automatically pick up a future `Torneo` type without a Mobile code change — but the team should not expect it to be true it will fire before the backend team adds that row.

**What happens if the backend never adds a `Torneo` type**: the tab is not broken or degraded — it simply and correctly shows only friendlies (`Amistoso`), which is a valid non-empty subset of what the user asked for. The empty-state copy ("no hay amistosos ni torneos próximos") stays accurate either way since it's phrased as "neither exists", not "we found zero of type X". No follow-up action is required unless the product later decides a real `Torneo` type is needed, which is a backend-owned addition (new `SportEventType` + migration), out of scope here.

## Goals / Non-Goals

**Goals:**
- One new tab, one new screen, reusing existing endpoints and existing `EventCard`/`EventDetailScreen`.
- Centralize the free-text event-type-name matching (today duplicated ad hoc inside `EventCard.tsx`) into one reusable module so this change doesn't add a third copy of the same substring logic.
- Correctly scope "upcoming" (today's date onward) and sort ascending.

**Non-Goals:**
- No backend changes; no new `SportEventType` row; no new query params beyond what `GET /api/sport-events/{teamId}` already accepts.
- No changes to `CalendarScreen.tsx`'s own filter UI/behavior (`EventFiltersModal`, `useEventFilters`) — that screen keeps showing all event types as today.
- No pagination UI in the new screen (mirrors `CalendarScreen`'s single-page-of-50 approach).

## Decisions

### 1. Extract a shared event-type-name matcher module

New file: `Mobile/src/utils/sportEventTypeMatchers.ts`

```ts
const normalize = (name?: string | null): string => (name ?? '').toLowerCase();

export const isTrainingEventType = (name?: string | null): boolean =>
  normalize(name).includes('entrenamiento');

export const isMatchEventType = (name?: string | null): boolean =>
  normalize(name).includes('partido');

export const isTournamentEventType = (name?: string | null): boolean => {
  const n = normalize(name);
  return n.includes('torneo') || n.includes('competici');
};

export const isFriendlyEventType = (name?: string | null): boolean =>
  normalize(name).includes('amistos');

export const isFriendlyOrTournamentEventType = (name?: string | null): boolean =>
  isFriendlyEventType(name) || isTournamentEventType(name);
```

- Lives under `Mobile/src/utils/` (existing home for cross-screen helpers like `resolvePhotoUrl.ts`), not `screens/hooks/` — it's a pure function, not a hook, and it's consumed by a `screens/components/` file (`EventCard.tsx`) as well as a screen, so it doesn't belong under either specific screen's `hooks/`.
- **`EventCard.tsx` refactor**: replace its inline `getHeaderStyle` checks and the `isMatch` line with calls to `isTrainingEventType`, `isTournamentEventType`, `isMatchEventType` from this module. Behavior is unchanged (same substrings, same precedence: training checked first, then tournament, else generic) — this is a pure extraction, not a logic change, so `EventCard.test.tsx`'s existing assertions must keep passing unmodified.
- `isFriendlyEventType` / `isFriendlyOrTournamentEventType` are net-new (no prior inline equivalent existed for "amistoso" anywhere in the app) and are consumed only by `FriendliesScreen.tsx`.

### 2. New screen: `Mobile/src/screens/FriendliesScreen.tsx`

Mirrors `CalendarScreen.tsx`'s structure minus the filters modal (no user-facing filtering needed — the screen's entire purpose *is* a fixed filter):

- `useRoute()` → `{ teamId, teamPlayerId }` from `route.params` (same shape as `CalendarScreen`).
- `useState` for `events: SportEvent[]`, `eventTypeMap: SportEventTypeMap`, `loading`, `error`, `refreshing`.
- `useEffect` on `[teamId]` → `fetchFriendlies()`.
- `fetchFriendlies()`:
  - Guards `!teamId` the same way `CalendarScreen` does (`setError('Team ID not provided')`).
  - Calls `Promise.all([api.get('/api/sport-events/${teamId}', { params: { pageNumber: 1, pageSize: 50, descending: false, startDate: new Date().toISOString() } }), fetchSportEventTypeMap()])`. Passing `startDate` (a parameter the endpoint already accepts, per `CalendarScreen`'s own usage) pushes "only upcoming" filtering to the backend instead of fetching everything and filtering client-side for staleness — reuses an existing capability, adds no backend work.
  - `try/catch` sets `error` to `e.response?.data?.detail || 'Error al cargar los amistosos y torneos'` (Spanish fallback, per convention).
- Derived list (render-time, not stored state): `events.filter((e) => isFriendlyOrTournamentEventType(eventTypeMap[e.eventTypeId ?? -1])).sort((a, b) => new Date(a.eveDateTime).getTime() - new Date(b.eveDateTime).getTime())`. Client-side sort is kept even though the API is asked for ascending order, matching `CalendarScreen`'s defensive posture of not fully trusting server ordering for a derived/filtered subset.
- Four states, same `testID` conventions as `CalendarScreen`/`EventDetailScreen` for consistency and testability:
  - `loading-indicator` (`ActivityIndicator`)
  - `error-message` + `retry-button` (calls `fetchFriendlies`)
  - `empty-message`: **"No hay amistosos ni torneos próximos"** — shown when the filtered+sorted list is empty (covers both "API returned nothing" and "API returned events but none are friendly/tournament").
  - `FlatList` of `EventCard` (same as `CalendarScreen`), `onPress` → `navigation.navigate('EventDetail', { eventId, teamId, teamPlayerId })`.
- `RefreshControl` wired to `onRefresh` → `fetchFriendlies()`, same as `CalendarScreen`.
- Section title text: `"Amistosos y torneos"` (no filter button, unlike `CalendarScreen`'s header row).
- Colors from `coachColors` (`src/theme/colors.ts`), no new hex values — same palette `CalendarScreen` uses.

### 3. Navigation wiring (`Mobile/src/navigation/RootNavigator.tsx`)

- New `Tab.Screen`:
  ```tsx
  <Tab.Screen
    name="FriendliesTab"
    component={FriendliesScreen}
    initialParams={{ teamId, teamPlayerId }}
    options={{
      tabBarLabel: 'Amistosos',
      tabBarIcon: ({ color, size }) => <Ionicons name="football-outline" size={size} color={color} />,
    }}
  />
  ```
- **Placement**: immediately after `CalendarTab`, before `NewsTab` — groups the two event-oriented tabs together at the front of the tab bar. (`Eventos, Amistosos, Noticias, Estadísticas, Liga`.)
- **`initialParams` includes `teamPlayerId`**, unlike `PlayersTab`/`LeagueTab` (which only get `teamId`). Reason: `FriendliesTab`, like `CalendarTab`, navigates onward to `EventDetail`, which uses `teamPlayerId` to highlight "my" row and to gate edit permissions in the attendance roster (see `EventDetailScreen.tsx`). `PlayersTab`/`LeagueTab` never navigate to `EventDetail`, so they don't need it.
- **Icon**: `football-outline`. Verified (not assumed) against the installed icon set: `node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json` (bundled by the installed `@expo/vector-icons@15.0.3`, matching `Mobile/package.json`) lists `football`, `football-outline`, `football-sharp` as valid glyphs. Chosen over `trophy-outline` (already used by `LeagueTab` — reusing it would make two tabs visually indistinguishable at a glance) and over `shield-outline`/`flag-outline` (also valid glyphs in the same set, but less literal for "amistoso/torneo" than a ball icon). Consulted per `Mobile/AGENTS.md`'s standing instruction to verify Expo/icon APIs against the installed version rather than assume.
- **Tab `name` is stable and internal** (`FriendliesTab`), distinct from the visible `tabBarLabel` (`'Amistosos'`), per the project's navigation convention — nothing today reads this name programmatically, but keeping the convention avoids surprises if something does later.

### 4. No new API client file

Reuses `api` from `Mobile/src/api/client.ts` directly (same as `CalendarScreen.tsx` does for `/api/sport-events/{teamId}`) and `fetchSportEventTypeMap()` from `Mobile/src/api/sportEventTypes.ts`. No new file under `Mobile/src/api/` — there's no new resource, just a different consumer of the same one.

## Risks / Trade-offs

- **[Risk] The tab will show zero results indefinitely if the club never runs friendlies and the backend never adds a `Torneo` type.** → Mitigation: this is correct behavior, not a bug (see "Resolved decision" above); the empty state message already communicates it clearly rather than implying an error.
- **[Risk] Refactoring `EventCard.tsx` to use the new matcher module could silently change its behavior if the extraction isn't exact.** → Mitigation: `EventCard.test.tsx` already exercises `isMatch`/`getHeaderStyle`-driven rendering (badge/header per type name); run it unmodified after the refactor and treat any failure as a regression to fix, not a test to update.
- **[Risk] `startDate: new Date().toISOString()` computed at request time means "upcoming" is defined at fetch time, not decided by the UI.** An event starting a few seconds after the fetch and before the user finishes reading a stale list could theoretically look "in the past" only after a manual refresh. → Mitigation: acceptable — `CalendarScreen` has the same characteristic for any date-filtered fetch, and pull-to-refresh already exists on this screen.
- **[Trade-off] Client-side re-sort of an already-server-sorted-and-filtered list is slightly redundant.** → Accepted deliberately: the client-side type filter (`isFriendlyOrTournamentEventType`) happens after the fetch, so re-sorting after filtering is the only way to guarantee order on the *rendered* subset, not just the fetched superset.

## Open Questions

None blocking `tasks.md`. Copy strings (`'Amistosos'`, `'Amistosos y torneos'`, empty-state text) are proposed above and can be adjusted in implementation/review without changing the design's structure.
