import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  SimulationPlayerState,
  SubstitutionSwap,
  SubstitutionWindow,
} from "../components/simulation/simulation.types";
import type {
  GoalEvent,
  LiveMatchBackup,
  LiveMatchPhase,
  WindowRatingSnapshot,
  LiveMatchParticipationPayload,
  PlayerParticipationDto,
} from "../components/simulation/liveMatch.types";
import {
  saveLiveMatchBackup,
  loadLiveMatchBackup,
  clearLiveMatchBackup,
  saveMatchParticipation,
  getMatchParticipation,
  deleteMatchParticipation,
} from "../../../services/liveMatchService";

export const MAX_TOTAL_WINDOWS = 4;
export const MAX_SECOND_HALF_WINDOWS = 3;

// ─── Public interface ────────────────────────────────────────────────────────

export interface UseLiveMatchReturn {
  // Phase
  matchPhase: LiveMatchPhase;
  // Timer
  currentMinute: number;
  currentSecond: number;
  half: 1 | 2;
  isHalftime: boolean;
  halfDuration: number;
  setHalfDuration: (minutes: number) => void;
  // Field state
  slots: Record<number, string | null>;
  playerStates: Record<string, SimulationPlayerState>;
  playerMinutes: Record<string, number>;
  initialSlots: Record<number, string | null>;
  initialized: boolean;
  // Windows
  windows: SubstitutionWindow[];
  prepareMode: boolean;
  prepareSlotsPreview: Record<number, string | null>;
  lastCommittedWindow: SubstitutionWindow | null;
  windowsTotal: number;
  windowsInSecondHalf: number;
  canOpenWindow: boolean;
  // Goals & score
  goals: GoalEvent[];
  scoreLocal: number;
  scoreVisitor: number;
  // Rating snapshots
  ratingSnapshots: WindowRatingSnapshot[];
  // Pending confirmation
  pendingAction: PendingAction;
  setPendingAction: (action: PendingAction) => void;
  // Save state
  isSaving: boolean;
  saveError: string | null;
  // Explicit save confirmation
  isSaveConfirmOpen: boolean;
  requestSave: () => void;
  confirmSave: () => void;
  cancelSave: () => void;
  // Persisted data (when match has been saved before)
  hasSavedData: boolean;
  savedParticipationData: LiveMatchParticipationPayload | null;
  isDeleting: boolean;
  deleteParticipation: () => Promise<void>;
  // Backup
  backup: LiveMatchBackup | null;
  // Actions
  initMatch: (initialSlots: Record<number, string | null>) => void;
  confirmAction: () => void;
  cancelAction: () => void;
  addGoal: (scorerId: string | null, scorerName: string | null, scorerDorsal: number | null, isOwnTeam: boolean) => void;
  removeGoal: (goalId: string) => void;
  startPrepare: () => void;
  cancelPrepare: () => void;
  movePreparePlayer: (draggedId: string, fromSlotIndex: number | null, targetSlotIndex: number) => void;
  movePreparePlayerToBench: (draggedId: string, fromSlotIndex: number) => void;
  commitWindow: (ratingsByPlayerId: Record<string, number | null>) => void;
  dismissConfirmation: () => void;
  dismissSaveError: () => void;
  acceptBackup: () => void;
  discardBackup: () => void;
}

export type PendingAction =
  | "startMatch"
  | "endFirstHalf"
  | "startSecondHalf"
  | "endMatch"
  | null;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLiveMatch(
  eventId: string | null,
  teamId: string,
  isHomeTeam = true,
): UseLiveMatchReturn {
  // ── Phase & timer ────────────────────────────────────────────────────────
  const [matchPhase, setMatchPhase] = useState<LiveMatchPhase>("preMatch");
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [half, setHalf] = useState<1 | 2>(1);
  const [isHalftime, setIsHalftime] = useState(false);
  const [halfDuration, setHalfDurationState] = useState(45);

  // ── Field ────────────────────────────────────────────────────────────────
  const [slots, setSlots] = useState<Record<number, string | null>>({});
  const [playerStates, setPlayerStates] = useState<Record<string, SimulationPlayerState>>({});
  const [windows, setWindows] = useState<SubstitutionWindow[]>([]);
  const [prepareMode, setPrepareMode] = useState(false);
  const [prepareSlotsPreview, setPrepareSlotsPreview] = useState<Record<number, string | null>>({});
  const [lastCommittedWindow, setLastCommittedWindow] = useState<SubstitutionWindow | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [initialSlotsSnapshot, setInitialSlotsSnapshot] = useState<Record<number, string | null>>({});

  // ── Goals & score ────────────────────────────────────────────────────────
  const [goals, setGoals] = useState<GoalEvent[]>([]);
  const [scoreLocal, setScoreLocal] = useState(0);
  const [scoreVisitor, setScoreVisitor] = useState(0);

  // ── Rating snapshots ─────────────────────────────────────────────────────
  const [ratingSnapshots, setRatingSnapshots] = useState<WindowRatingSnapshot[]>([]);

  // ── Pending confirmation dialog ──────────────────────────────────────────
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  // ── Save state ───────────────────────────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);  const [isSaveConfirmOpen, setIsSaveConfirmOpen] = useState(false);
  const [hasSavedData, setHasSavedData] = useState(false);
  const [savedParticipationData, setSavedParticipationData] = useState<LiveMatchParticipationPayload | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // ── Backup ───────────────────────────────────────────────────────────────
  const [backup, setBackup] = useState<LiveMatchBackup | null>(null);

  // ── Stable refs ──────────────────────────────────────────────────────────
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const slotsRef = useRef<Record<number, string | null>>({});
  const playerStatesRef = useRef<Record<string, SimulationPlayerState>>({});
  const windowsRef = useRef<SubstitutionWindow[]>([]);
  const prepareSlotsRef = useRef<Record<number, string | null>>({});
  const initialSlotsRef = useRef<Record<number, string | null>>({});
  const currentMinuteRef = useRef(0);
  const halfRef = useRef<1 | 2>(1);
  const isHalftimeRef = useRef(false);
  const wasRunningRef = useRef(false);
  const matchPhaseRef = useRef<LiveMatchPhase>("preMatch");
  const goalsRef = useRef<GoalEvent[]>([]);
  const scoreLocalRef = useRef(0);
  const scoreVisitorRef = useRef(0);
  const ratingSnapshotsRef = useRef<WindowRatingSnapshot[]>([]);
  const halfDurationRef = useRef(45);
  const totalSecondsRef = useRef(0);
  const eventIdRef = useRef<string | null>(null);
  const teamIdRef = useRef(teamId);

  // Sync refs
  slotsRef.current = slots;
  playerStatesRef.current = playerStates;
  windowsRef.current = windows;
  prepareSlotsRef.current = prepareSlotsPreview;
  halfRef.current = half;
  isHalftimeRef.current = isHalftime;
  matchPhaseRef.current = matchPhase;
  goalsRef.current = goals;
  scoreLocalRef.current = scoreLocal;
  scoreVisitorRef.current = scoreVisitor;
  ratingSnapshotsRef.current = ratingSnapshots;
  halfDurationRef.current = halfDuration;
  totalSecondsRef.current = totalSeconds;
  eventIdRef.current = eventId;
  teamIdRef.current = teamId;

  const currentMinute = Math.floor(totalSeconds / 60);
  const currentSecond = totalSeconds % 60;
  currentMinuteRef.current = currentMinute;

  // ── Derived ───────────────────────────────────────────────────────────────

  const isRunning =
    matchPhase === "firstHalf" || matchPhase === "secondHalf";

  const windowsTotal = windows.filter((w) => !w.isHalftime).length;
  const windowsInSecondHalf = windows.filter((w) => w.half === 2 && !w.isHalftime).length;
  const canOpenWindow =
    !prepareMode &&
    (matchPhase === "firstHalf" ||
      matchPhase === "secondHalf" ||
      matchPhase === "halftime") &&
    (isHalftime ||
      (windowsTotal < MAX_TOTAL_WINDOWS &&
        (half === 1 || windowsInSecondHalf < MAX_SECOND_HALF_WINDOWS)));

  // ── Player minutes ────────────────────────────────────────────────────────

  const playerMinutes = useMemo(() => {
    const result: Record<string, number> = {};
    for (const [pid, state] of Object.entries(playerStates)) {
      result[pid] = state.isOnField
        ? state.accumulatedMinutes + Math.max(0, currentMinute - state.minuteEntered)
        : state.accumulatedMinutes;
    }
    return result;
  }, [playerStates, currentMinute]);

  // ── Timer interval ────────────────────────────────────────────────────────

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTotalSeconds((prev) => Math.min(7200, prev + 1));
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning]);

  // ── Backup on page leave ──────────────────────────────────────────────────

  const writeBackup = useCallback(() => {
    const eid = eventIdRef.current;
    const phase = matchPhaseRef.current;
    if (!eid || phase === "preMatch" || phase === "finished") return;

    const backupData: LiveMatchBackup = {
      eventId: eid,
      teamId: teamIdRef.current,
      savedAt: new Date().toISOString(),
      matchPhase: phase,
      totalSeconds: totalSecondsRef.current,
      half: halfRef.current,
      isHalftime: isHalftimeRef.current,
      halfDuration: halfDurationRef.current,
      slots: { ...slotsRef.current },
      initialSlots: { ...initialSlotsRef.current },
      playerStates: { ...playerStatesRef.current },
      windows: [...windowsRef.current],
      goals: [...goalsRef.current],
      ratingSnapshots: [...ratingSnapshotsRef.current],
      scoreLocal: scoreLocalRef.current,
      scoreVisitor: scoreVisitorRef.current,
    };
    saveLiveMatchBackup(eid, backupData);
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => writeBackup();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") writeBackup();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [writeBackup]);
  // ── Load saved participation on mount (re-entry detection) ─────────────────

  useEffect(() => {
    if (!eventId) return;
    let mounted = true;
    getMatchParticipation(eventId).then((data) => {
      if (!mounted) return;
      if (data && data.matchPhase === "finished") {
        setHasSavedData(true);
        setSavedParticipationData(data);
      }
    }).catch(() => {});
    return () => { mounted = false; };
  }, [eventId]);
  // ── Check for backup on eventId change ───────────────────────────────────

  useEffect(() => {
    if (!eventId) return;
    const b = loadLiveMatchBackup<LiveMatchBackup>(eventId);
    if (b) setBackup(b);
  }, [eventId]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  function buildInitialPlayerStates(
    newSlots: Record<number, string | null>,
    startMinute = 0,
  ): Record<string, SimulationPlayerState> {
    const states: Record<string, SimulationPlayerState> = {};
    for (const [slotIdx, pid] of Object.entries(newSlots)) {
      if (pid) {
        states[pid] = {
          playerId: pid,
          slotIndex: parseInt(slotIdx),
          minuteEntered: startMinute,
          accumulatedMinutes: 0,
          isOnField: true,
        };
      }
    }
    return states;
  }

  function restoreFromBackup(b: LiveMatchBackup) {
    // Compute elapsed seconds since backup was saved
    const savedAt = new Date(b.savedAt).getTime();
    const now = Date.now();
    const elapsedSec = Math.floor((now - savedAt) / 1000);
    const restoredSeconds = Math.min(7200, b.totalSeconds + elapsedSec);

    // Determine if match would be over after adding elapsed time
    const maxSeconds = b.halfDuration * 2 * 60;
    const isOver = restoredSeconds >= maxSeconds && b.half === 2;

    const restoredPhase: LiveMatchPhase = isOver ? "finished" : b.matchPhase;

    initialSlotsRef.current = { ...b.initialSlots };
    setInitialSlotsSnapshot({ ...b.initialSlots });
    setTotalSeconds(restoredSeconds);
    setHalf(b.half);
    setIsHalftime(b.isHalftime);
    setHalfDurationState(b.halfDuration);
    setSlots({ ...b.slots });
    setPlayerStates(
      updatePlayerStatesForElapsedTime(b.playerStates, b.matchPhase, elapsedSec, Math.floor(b.totalSeconds / 60)),
    );
    setWindows([...b.windows]);
    setGoals([...b.goals]);
    setRatingSnapshots([...b.ratingSnapshots]);
    setScoreLocal(b.scoreLocal);
    setScoreVisitor(b.scoreVisitor);
    setPrepareMode(false);
    setPrepareSlotsPreview({});
    setLastCommittedWindow(null);
    setInitialized(true);
    setMatchPhase(restoredPhase);
  }

  /** When restoring, add elapsed offline time to isOnField players */
  function updatePlayerStatesForElapsedTime(
    states: Record<string, SimulationPlayerState>,
    phase: LiveMatchPhase,
    _elapsedSec: number,
    _baseMinute: number,
  ): Record<string, SimulationPlayerState> {
    const wasTimerRunning = phase === "firstHalf" || phase === "secondHalf";
    if (!wasTimerRunning) return { ...states };
    const updated: Record<string, SimulationPlayerState> = {};
    for (const [pid, state] of Object.entries(states)) {
      updated[pid] = { ...state };
    }
    return updated;
  }

  // ── initMatch ─────────────────────────────────────────────────────────────

  const initMatch = useCallback((initialSlots: Record<number, string | null>) => {
    initialSlotsRef.current = { ...initialSlots };
    setInitialSlotsSnapshot({ ...initialSlots });
    setTotalSeconds(0);
    setHalf(1);
    setIsHalftime(false);
    setMatchPhase("preMatch");
    setSlots({ ...initialSlots });
    setPlayerStates(buildInitialPlayerStates(initialSlots));
    setWindows([]);
    setGoals([]);
    setRatingSnapshots([]);
    setScoreLocal(0);
    setScoreVisitor(0);
    setPrepareMode(false);
    setPrepareSlotsPreview({});
    setLastCommittedWindow(null);
    setInitialized(true);
    setSaveError(null);
  }, []);

  // ── Confirmation flow ─────────────────────────────────────────────────────

  const confirmAction = useCallback(() => {
    const action = pendingAction;
    setPendingAction(null);

    switch (action) {
      case "startMatch":
        setMatchPhase("firstHalf");
        // Re-init player states from minute 0
        setPlayerStates(buildInitialPlayerStates(initialSlotsRef.current, 0));
        break;

      case "endFirstHalf":
        setMatchPhase("halftime");
        setIsHalftime(true);
        setHalf(1); // stay on half 1 until second half starts
        break;

      case "startSecondHalf":
        setMatchPhase("secondHalf");
        setIsHalftime(false);
        setHalf(2);
        break;

      case "endMatch":
        setMatchPhase("finished");
        setIsHalftime(false);
        // Freeze all playerStates: anyone still on field gets their minutes locked
        setPlayerStates((prev) => {
          const minute = currentMinuteRef.current;
          const updated: Record<string, SimulationPlayerState> = {};
          for (const [pid, state] of Object.entries(prev)) {
            if (state.isOnField) {
              updated[pid] = {
                ...state,
                accumulatedMinutes:
                  state.accumulatedMinutes + Math.max(0, minute - state.minuteEntered),
                isOnField: false,
              };
            } else {
              updated[pid] = { ...state };
            }
          }
          return updated;
        });
        // Do NOT auto-save — user must confirm explicitly via requestSave()
        break;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAction]);

  const cancelAction = useCallback(() => {
    setPendingAction(null);
  }, []);

  // ── Persist match participation ───────────────────────────────────────────

  async function persistMatchParticipation() {
    const eid = eventIdRef.current;
    if (!eid) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const minute = currentMinuteRef.current;
      const states = playerStatesRef.current;

      const players: PlayerParticipationDto[] = Object.entries(states).map(([pid, state]) => {
        const finalMinutes = state.isOnField
          ? state.accumulatedMinutes + Math.max(0, minute - state.minuteEntered)
          : state.accumulatedMinutes;

        // Determine if starter (was in initial slots)
        const isStarter = Object.values(initialSlotsRef.current).includes(pid);

        return {
          teamPlayerId: pid,
          minutesPlayed: Math.round(finalMinutes),
          isStarter,
          enteredAtMinute: isStarter ? 0 : state.minuteEntered,
          exitedAtMinute: state.isOnField ? null : minute,
        };
      });

      const payload: LiveMatchParticipationPayload = {
        teamId: teamIdRef.current,
        scoreLocal: scoreLocalRef.current,
        scoreVisitor: scoreVisitorRef.current,
        matchPhase: "finished",
        players,
        substitutionWindowsJson: JSON.stringify(windowsRef.current),
        ratingSnapshotsJson: JSON.stringify(ratingSnapshotsRef.current),
        goalsJson: JSON.stringify(goalsRef.current),
      };

      await saveMatchParticipation(eid, payload);
      clearLiveMatchBackup(eid);
      setHasSavedData(true);
      setSavedParticipationData(payload);
    } catch {
      setSaveError("Error al guardar los datos del partido. Inténtalo de nuevo.");
    } finally {
      setIsSaving(false);
    }
  }

  // ── Explicit save actions ──────────────────────────────────────────────────

  const requestSave = useCallback(() => {
    setIsSaveConfirmOpen(true);
  }, []);

  const confirmSave = useCallback(() => {
    setIsSaveConfirmOpen(false);
    void persistMatchParticipation();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancelSave = useCallback(() => {
    setIsSaveConfirmOpen(false);
  }, []);

  const deleteParticipation = useCallback(async () => {
    const eid = eventIdRef.current;
    const tid = teamIdRef.current;
    if (!eid || !tid) return;
    setIsDeleting(true);
    try {
      await deleteMatchParticipation(eid, tid);
      setHasSavedData(false);
      setSavedParticipationData(null);
    } finally {
      setIsDeleting(false);
    }
  }, []);

  // ── Goals ─────────────────────────────────────────────────────────────────

  const addGoal = useCallback(
    (
      scorerId: string | null,
      scorerName: string | null,
      scorerDorsal: number | null,
      isOwnTeam: boolean,
    ) => {
      const minute = currentMinuteRef.current;
      // isOwnTeam=true means goal for the user's team.
      // isHomeTeam determines whether our team is LOCAL or VISITOR.
      const localScores = isOwnTeam ? isHomeTeam : !isHomeTeam;
      const newLocal = localScores ? scoreLocalRef.current + 1 : scoreLocalRef.current;
      const newVisitor = !localScores ? scoreVisitorRef.current + 1 : scoreVisitorRef.current;
      const goal: GoalEvent = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        minute,
        scorerId,
        scorerName,
        scorerDorsal,
        isOwnTeam,
        scoreAtMoment: { local: newLocal, visitor: newVisitor },
      };
      setGoals((prev) => [...prev, goal]);
      if (localScores) setScoreLocal(newLocal);
      else setScoreVisitor(newVisitor);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isHomeTeam],
  );

  const removeGoal = useCallback((goalId: string) => {
    setGoals((prev) => {
      const idx = prev.findIndex((g) => g.id === goalId);
      if (idx === -1) return prev;
      const removed = prev[idx];
      const next = prev.filter((g) => g.id !== goalId);
      // Recompute score — same isHomeTeam logic as addGoal
      const removedLocal = removed.isOwnTeam ? isHomeTeam : !isHomeTeam;
      if (removedLocal) setScoreLocal((s) => Math.max(0, s - 1));
      else setScoreVisitor((s) => Math.max(0, s - 1));
      // Recompute scoreAtMoment for all remaining goals
      let loc = 0;
      let vis = 0;
      return next.map((g) => {
        const gLocal = g.isOwnTeam ? isHomeTeam : !isHomeTeam;
        if (gLocal) loc++;
        else vis++;
        return { ...g, scoreAtMoment: { local: loc, visitor: vis } };
      });
    });
  }, [isHomeTeam]);

  // ── Substitution window logic (mirrors useMatchSimulation) ────────────────

  const startPrepare = useCallback(() => {
    setPrepareMode(true);
    setPrepareSlotsPreview({ ...slotsRef.current });
  }, []);

  const cancelPrepare = useCallback(() => {
    setPrepareMode(false);
    setPrepareSlotsPreview({});
  }, []);

  const movePreparePlayer = useCallback(
    (draggedId: string, fromSlotIndex: number | null, targetSlotIndex: number) => {
      setPrepareSlotsPreview((prev) => {
        const next = { ...prev };
        const currentOccupant = prev[targetSlotIndex] ?? null;
        next[targetSlotIndex] = draggedId;
        if (fromSlotIndex !== null) {
          next[fromSlotIndex] = currentOccupant;
        }
        return next;
      });
    },
    [],
  );

  const movePreparePlayerToBench = useCallback((draggedId: string, fromSlotIndex: number) => {
    setPrepareSlotsPreview((prev) => {
      const next = { ...prev };
      next[fromSlotIndex] = null;
      return next;
    });
  }, []);

  const commitWindow = useCallback((ratingsByPlayerId: Record<string, number | null>) => {
    const minute = currentMinuteRef.current;
    const currentSlots = slotsRef.current;
    const newSlots = prepareSlotsRef.current;
    const prevWindows = windowsRef.current;
    const prevPlayerStates = playerStatesRef.current;

    const currentOnField = new Set(Object.values(currentSlots).filter(Boolean) as string[]);
    const newOnField = new Set(Object.values(newSlots).filter(Boolean) as string[]);
    const leaving = [...currentOnField].filter((pid) => !newOnField.has(pid));
    const entering = [...newOnField].filter((pid) => !currentOnField.has(pid));

    const swaps: SubstitutionSwap[] = entering.map((inPid, i) => {
      const entry = Object.entries(newSlots).find(([, pid]) => pid === inPid)!;
      const targetSlotIdx = parseInt(entry[0]);
      const outPid = leaving[i] ?? null;
      return { inPlayerId: inPid, outPlayerId: outPid, slotIndex: targetSlotIdx };
    });

    const currentHalf = halfRef.current;
    const currentIsHalftime = isHalftimeRef.current;
    const windowIndex = currentIsHalftime
      ? 0
      : prevWindows.filter((w) => !w.isHalftime).length + 1;

    const newWindow: SubstitutionWindow = {
      windowIndex,
      minute,
      half: currentHalf,
      swaps,
      slotsAfter: { ...newSlots },
      ...(currentIsHalftime ? { isHalftime: true } : {}),
    };

    // Rating snapshot
    const snapshot: WindowRatingSnapshot = {
      windowIndex,
      minute,
      ratings: { ...ratingsByPlayerId },
    };

    // Update player states
    const nextPlayerStates = { ...prevPlayerStates };
    for (const pid of leaving) {
      const state = nextPlayerStates[pid];
      if (state) {
        nextPlayerStates[pid] = {
          ...state,
          accumulatedMinutes:
            state.accumulatedMinutes + Math.max(0, minute - state.minuteEntered),
          isOnField: false,
          slotIndex: null,
        };
      }
    }
    for (const pid of entering) {
      const entry = Object.entries(newSlots).find(([, p]) => p === pid);
      const targetSlotIdx = entry ? parseInt(entry[0]) : null;
      nextPlayerStates[pid] = {
        playerId: pid,
        slotIndex: targetSlotIdx,
        minuteEntered: minute,
        accumulatedMinutes: nextPlayerStates[pid]?.accumulatedMinutes ?? 0,
        isOnField: true,
      };
    }

    wasRunningRef.current = matchPhaseRef.current === "firstHalf" || matchPhaseRef.current === "secondHalf";

    setPlayerStates(nextPlayerStates);
    setSlots({ ...newSlots });
    setWindows((prev) => [...prev, newWindow]);
    setRatingSnapshots((prev) => [...prev, snapshot]);
    setPrepareMode(false);
    setPrepareSlotsPreview({});
    setLastCommittedWindow(newWindow);
  }, []);

  const dismissConfirmation = useCallback(() => {
    setLastCommittedWindow(null);
  }, []);

  // ── Backup accept / discard ───────────────────────────────────────────────

  const acceptBackup = useCallback(() => {
    if (!backup) return;
    restoreFromBackup(backup);
    setBackup(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backup]);

  const discardBackup = useCallback(() => {
    if (!backup) return;
    clearLiveMatchBackup(backup.eventId);
    setBackup(null);
  }, [backup]);

  // ── halfDuration setter ───────────────────────────────────────────────────

  const setHalfDuration = useCallback((minutes: number) => {
    setHalfDurationState(minutes);
  }, []);

  const dismissSaveError = useCallback(() => setSaveError(null), []);

  return {
    matchPhase,
    currentMinute,
    currentSecond,
    half,
    isHalftime,
    halfDuration,
    setHalfDuration,
    slots,
    playerStates,
    playerMinutes,
    initialSlots: initialSlotsSnapshot,
    initialized,
    windows,
    prepareMode,
    prepareSlotsPreview,
    lastCommittedWindow,
    windowsTotal,
    windowsInSecondHalf,
    canOpenWindow,
    goals,
    scoreLocal,
    scoreVisitor,
    ratingSnapshots,
    pendingAction,
    setPendingAction,
    isSaving,
    saveError,
    isSaveConfirmOpen,
    requestSave,
    confirmSave,
    cancelSave,
    hasSavedData,
    savedParticipationData,
    isDeleting,
    deleteParticipation,
    backup,
    initMatch,
    confirmAction,
    cancelAction,
    addGoal,
    removeGoal,
    startPrepare,
    cancelPrepare,
    movePreparePlayer,
    movePreparePlayerToBench,
    commitWindow,
    dismissConfirmation,
    dismissSaveError,
    acceptBackup,
    discardBackup,
  };
}
