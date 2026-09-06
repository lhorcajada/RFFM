# Design: Permitir editar un partido ya guardado

All paths under `Front/src/apps/coach/pages/convocations/`.

## Problem detail (read `hooks/useLiveMatch.ts` fully before editing)

Two independent effects/paths currently race without coordination:

1. `initMatch(initialSlots)` (called imperatively by `PartidoEnDirectoTab.tsx` once the saved
   lineup loads) unconditionally does `setMatchPhase("preMatch")`, `setGoals([])`,
   `setCards([])`, `setScoreLocal(0)`, `setScoreVisitor(0)`, `setWindows([])`,
   `setFormationChanges([])`, `setRatingSnapshots([])`.
2. The mount effect that calls `getMatchParticipation(eventId)` only sets `hasSavedData`/
   `savedParticipationData` — it never touches `matchPhase`/`goals`/`cards`/etc.

Because both are async and unordered relative to each other, a hydration fix must be resilient
to running before *or* after `initMatch`.

## Hook changes (`hooks/useLiveMatch.ts`)

1. Add a small local helper (module scope, above the hook, or inline where used):
   ```ts
   function parseJsonArray<T>(json: string | undefined, fallback: T[]): T[] {
     if (!json) return fallback;
     try {
       const parsed = JSON.parse(json);
       return Array.isArray(parsed) ? (parsed as T[]) : fallback;
     } catch {
       return fallback;
     }
   }
   ```

2. Add a ref mirroring the latest fetched saved participation, so both call sites can read it
   synchronously regardless of render timing:
   ```ts
   const savedParticipationRef = useRef<LiveMatchParticipationPayload | null>(null);
   ```

3. Extract the hydration into a function usable from both places:
   ```ts
   function hydrateFromSavedParticipation(data: LiveMatchParticipationPayload) {
     setMatchPhase("finished");
     setScoreLocal(data.scoreLocal);
     setScoreVisitor(data.scoreVisitor);
     setGoals(parseJsonArray<GoalEvent>(data.goalsJson, []));
     setCards(parseJsonArray<CardEvent>(data.cardsJson, []));
     setWindows(parseJsonArray<SubstitutionWindow>(data.substitutionWindowsJson, []));
     setFormationChanges(parseJsonArray<FormationChangeEvent>(data.formationChangesJson, []));
     setRatingSnapshots(parseJsonArray<WindowRatingSnapshot>(data.ratingSnapshotsJson, []));
   }
   ```

4. In the `getMatchParticipation` mount effect (design: keep existing `setHasSavedData`/
   `setSavedParticipationData` calls, add the ref + hydration call):
   ```ts
   getMatchParticipation(eventId).then((data) => {
     if (!mounted) return;
     if (data && data.matchPhase === "finished") {
       savedParticipationRef.current = data;
       setHasSavedData(true);
       setSavedParticipationData(data);
       hydrateFromSavedParticipation(data);
     }
   }).catch(() => {});
   ```
   This covers the case where the participation fetch resolves *after* `initMatch` already ran
   (the common case, since `initMatch` depends on a separate lineup fetch) — it simply
   overwrites the freshly-reset preMatch state with the saved one.

5. In `initMatch`, guard the reset using the ref (covers the case where the participation fetch
   already resolved *before* `initMatch` runs):
   ```ts
   const initMatch = useCallback((initialSlots: Record<number, string | null>) => {
     initialSlotsRef.current = { ...initialSlots };
     setInitialSlotsSnapshot({ ...initialSlots });
     runAnchorEpochRef.current = null;
     runBaselineSecondsRef.current = 0;
     setTotalSeconds(0);
     setHalf(1);
     setIsHalftime(false);
     setSlots({ ...initialSlots });
     setPlayerStates(buildInitialPlayerStates(initialSlots));
     setPrepareMode(false);
     setPrepareSlotsPreview({});
     setLastCommittedWindow(null);
     setInitialized(true);
     setSaveError(null);
     if (savedParticipationRef.current) {
       hydrateFromSavedParticipation(savedParticipationRef.current);
     } else {
       setMatchPhase("preMatch");
       setGoals([]);
       setCards([]);
       setWindows([]);
       setFormationChanges([]);
       setRatingSnapshots([]);
       setScoreLocal(0);
       setScoreVisitor(0);
     }
   }, []);
   ```
   (`hydrateFromSavedParticipation` must be declared as a stable function — either a plain
   function in the hook body, referenced via closure like `restoreFromBackup` already is, or
   wrapped so `initMatch`'s `useCallback` deps stay correct; follow the existing pattern used
   by `restoreFromBackup`, which is a plain function, not a `useCallback`, and is fine as an
   `initMatch` dependency-free call since it only reads the ref + calls setters.)

6. No new fields need to be exported from the hook's public interface —
   `savedParticipationData` (already exported) is the single source components read from.

## Component changes (`components/PartidoEnDirectoTab.tsx`)

1. Seed `manualMinuteOverrides` from `live.savedParticipationData` once, when it becomes
   available and no session overrides exist yet:
   ```ts
   useEffect(() => {
     if (!live.savedParticipationData) return;
     setManualMinuteOverrides((prev) => {
       if (Object.keys(prev).length > 0) return prev;
       const seeded: Record<string, number> = {};
       for (const p of live.savedParticipationData!.players) seeded[p.teamPlayerId] = p.minutesPlayed;
       return seeded;
     });
   }, [live.savedParticipationData]);
   ```

2. Fix `handleManualSave`'s `isStarter` computation to prefer the persisted flag when this
   player's saved record exists (covers reopening after a reload, where `live.initialSlots` is
   just whatever `initMatch` set up from the lineup — not necessarily who actually started):
   ```ts
   const savedStarterById = new Map(
     (live.savedParticipationData?.players ?? []).map((p) => [p.teamPlayerId, p.isStarter]),
   );
   const players: PlayerParticipationDto[] = lineupPlayers.map((p) => ({
     teamPlayerId: p.id,
     minutesPlayed: overrides[p.id] ?? 0,
     isStarter: savedStarterById.has(p.id)
       ? savedStarterById.get(p.id)!
       : Object.values(live.initialSlots).includes(p.id),
     enteredAtMinute: null,
     exitedAtMinute: null,
   }));
   ```
   Add `live.savedParticipationData` to `handleManualSave`'s dependency array.

3. No other render-condition changes needed: every place gated on `live.matchPhase ===
   "finished"` (the post-match actions block, `GoalTimeline`/`CardsTimeline` visibility via the
   manual dialog, `MatchCompetitivenessReport`) now naturally activates once hydration sets
   `matchPhase` to `"finished"` on reopening a saved match — this was the whole point of
   hydrating `matchPhase` rather than adding a parallel `hasSavedData` branch everywhere.

## Tests (TDD — write first)

- `hooks/__tests__/useLiveMatch.enhancements.test.tsx` (extend): a new describe block
  "reopening a saved finished match" — mock `getMatchParticipation` to resolve with a
  `matchPhase: "finished"` payload including non-empty `goalsJson`/`cardsJson`/`scoreLocal`/
  `scoreVisitor`, and assert (a) when `initMatch` is called *before* the fetch resolves, the
  hook still ends up with `matchPhase === "finished"`, `goals`/`cards` populated, and (b) when
  `initMatch` is called *after* the fetch resolves, the same end state holds (both orderings —
  use `act`/`await` to control timing explicitly in each test).
- `components/__tests__/PartidoEnDirectoTab.*.test.tsx` (new or extend an existing file): with
  a mocked `getMatchParticipation` returning saved finished data, the "Edición manual del
  partido" button is visible and the minutes shown in the dialog match the saved
  `minutesPlayed` values; re-saving preserves each player's saved `isStarter`.

## Files touched summary

| File | Change |
|---|---|
| `hooks/useLiveMatch.ts` | hydration on saved-match reopen, race-safe vs `initMatch` |
| `hooks/__tests__/useLiveMatch.enhancements.test.tsx` | new tests per above |
| `components/PartidoEnDirectoTab.tsx` | seed minute overrides, fix `isStarter` on re-save |
| a `PartidoEnDirectoTab` test file | new/extended tests per above |
