import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  MatchSimulation,
  SimulationPlayerState,
  SubstitutionSwap,
  SubstitutionWindow,
} from "../components/simulation/simulation.types";

export const MAX_TOTAL_WINDOWS = 4;
export const MAX_SECOND_HALF_WINDOWS = 3;
/** @deprecated use halfDuration from the hook instead */
export const SECOND_HALF_MINUTE = 46;

// ─── Public interface ────────────────────────────────────────────────────────

export interface UseMatchSimulationReturn {
  // Runtime state
  currentMinute: number;
  currentSecond: number;
  isRunning: boolean;
  half: 1 | 2;
  slots: Record<number, string | null>;
  playerStates: Record<string, SimulationPlayerState>;
  /** Per-player minutes computed live every second */
  playerMinutes: Record<string, number>;
  windows: SubstitutionWindow[];
  prepareMode: boolean;
  prepareSlotsPreview: Record<number, string | null>;
  /** Non-null while the confirmation dialog for the last committed window should be open */
  lastCommittedWindow: SubstitutionWindow | null;
  initialized: boolean;
  /** Whether the match has been finished by the user */
  isFinished: boolean;
  /** Whether the match clock has reached full time (2 × halfDuration) in the 2nd half */
  isMatchOver: boolean;
  /** True when a saved simulation has been loaded (report should be visible) */
  isLoadedFromSave: boolean;
  /** Initial slot layout (the starters) */
  initialSlots: Record<number, string | null>;
  /** Duration of each half in minutes (default 45) */
  halfDuration: number;
  // Derived
  windowsTotal: number;
  windowsInSecondHalf: number;
  canOpenWindow: boolean;
  // Actions
  initSimulation: (initialSlots: Record<number, string | null>) => void;
  loadSimulation: (sim: MatchSimulation) => void;
  start: () => void;
  stop: () => void;
  reset: () => void;
  /** Finish the match — stops timer and freezes state */
  finishMatch: () => void;
  setHalfDuration: (minutes: number) => void;
  jumpToMinute: (minute: number) => void;
  advanceBy: (minutes: number) => void;
  /** Set half to 2 explicitly (second half starts by user action, not timer) */
  startSecondHalf: () => void;
  /** Enter halftime mode — substitutions won’t consume a window quota slot */
  startHalftime: () => void;
  startPrepare: () => void;
  cancelPrepare: () => void;
  /** Move a player during prepare mode: fromSlotIndex null means the player comes from the bench */
  movePreparePlayer: (
    draggedId: string,
    fromSlotIndex: number | null,
    targetSlotIndex: number,
  ) => void;
  movePreparePlayerToBench: (draggedId: string, fromSlotIndex: number) => void;
  /** Stop timer, apply swaps, display confirmation dialog */
  commitWindow: () => void;
  /** Close confirmation dialog and optionally resume timer */
  dismissConfirmation: () => void;
  /** Serialise current state into a MatchSimulation ready for localStorage */
  toMatchSimulation: (
    id: string,
    name: string,
    teamId: string,
    eventId: string,
    formationId: string,
  ) => MatchSimulation;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useMatchSimulation(): UseMatchSimulationReturn {
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [halfDuration, setHalfDuration] = useState(35);
  const [half, setHalf] = useState<1 | 2>(1);
  const [isHalftime, setIsHalftime] = useState(false);
  const isHalftimeRef = useRef(false);
  isHalftimeRef.current = isHalftime;
  const halfDurationRef = useRef(35);
  halfDurationRef.current = halfDuration;
  const halfRef = useRef<1 | 2>(1);
  halfRef.current = half;

  // Derived from totalSeconds
  const currentMinute = Math.floor(totalSeconds / 60);
  const currentSecond = totalSeconds % 60;
  const [slots, setSlots] = useState<Record<number, string | null>>({});
  const [playerStates, setPlayerStates] = useState<Record<string, SimulationPlayerState>>({});
  const [windows, setWindows] = useState<SubstitutionWindow[]>([]);
  const [prepareMode, setPrepareMode] = useState(false);
  const [prepareSlotsPreview, setPrepareSlotsPreview] = useState<Record<number, string | null>>(
    {},
  );
  const [lastCommittedWindow, setLastCommittedWindow] = useState<SubstitutionWindow | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isLoadedFromSave, setIsLoadedFromSave] = useState(false);

  // Exposed snapshot of initial slots (re-derived from ref when needed)
  const [initialSlotsSnapshot, setInitialSlotsSnapshot] = useState<Record<number, string | null>>({});

  // Stable refs so callbacks never go stale
  const currentMinuteRef = useRef(0);
  const isRunningRef = useRef(false);
  const slotsRef = useRef<Record<number, string | null>>({});
  const playerStatesRef = useRef<Record<string, SimulationPlayerState>>({});
  const windowsRef = useRef<SubstitutionWindow[]>([]);
  const prepareSlotsRef = useRef<Record<number, string | null>>({});
  const initialSlotsRef = useRef<Record<number, string | null>>({});
  const wasRunningRef = useRef(false);

  currentMinuteRef.current = currentMinute;
  isRunningRef.current = isRunning;
  slotsRef.current = slots;
  playerStatesRef.current = playerStates;
  windowsRef.current = windows;
  prepareSlotsRef.current = prepareSlotsPreview;

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Derived ───────────────────────────────────────────────────────────────

  // half is explicit state — only changes via startSecondHalf(), not from the timer
  // Halftime windows are tracked but excluded from quota counts
  const windowsTotal = windows.filter((w) => !w.isHalftime).length;
  const windowsInSecondHalf = windows.filter((w) => w.half === 2 && !w.isHalftime).length;
  const canOpenWindow =
    !prepareMode &&
    (isHalftime || (
      windowsTotal < MAX_TOTAL_WINDOWS &&
      (half === 1 || windowsInSecondHalf < MAX_SECOND_HALF_WINDOWS)
    ));
  const isMatchOver = !isRunning && half === 2 && totalSeconds >= halfDuration * 2 * 60;

  // ─── Timer interval ────────────────────────────────────────────────────────

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTotalSeconds((prev) => {
          const next = Math.min(7200, prev + 1);
          // Auto-stop at full time in the 2nd half
          if (halfRef.current === 2 && next >= halfDurationRef.current * 2 * 60) {
            setIsRunning(false);
          }
          return next;
        });
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

  // ─── Player minutes (recomputed every second) ──────────────────────────────

  const playerMinutes = useMemo(() => {
    const result: Record<string, number> = {};
    for (const [pid, state] of Object.entries(playerStates)) {
      result[pid] = state.isOnField
        ? state.accumulatedMinutes + Math.max(0, currentMinute - state.minuteEntered)
        : state.accumulatedMinutes;
    }
    return result;
  }, [playerStates, currentMinute]);

  // ─── Helpers ────────────────────────────────────────────────────────────────

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

  // ─── Actions ────────────────────────────────────────────────────────────────

  const initSimulation = useCallback((initialSlots: Record<number, string | null>) => {
    initialSlotsRef.current = { ...initialSlots };
    setTotalSeconds(0);
    setIsRunning(false);
    setHalf(1);
    setIsHalftime(false);
    setIsFinished(false);
    setIsLoadedFromSave(false);
    setInitialSlotsSnapshot({ ...initialSlots });
    setSlots({ ...initialSlots });
    setWindows([]);
    setPrepareMode(false);
    setPrepareSlotsPreview({});
    setLastCommittedWindow(null);
    setInitialized(true);
    setPlayerStates(buildInitialPlayerStates(initialSlots));
  }, []);

  const loadSimulation = useCallback((sim: MatchSimulation) => {
    initialSlotsRef.current = { ...sim.initialSlots };
    setTotalSeconds(sim.savedAtMinute * 60);
    setIsRunning(false);
    // Restore half from windows: if any window was in half 2, restore to half 2
    const restoredHalf: 1 | 2 = sim.windows.some((w) => w.half === 2) ? 2 : 1;
    setHalf(restoredHalf);
    setIsHalftime(false);
    setIsFinished(false);
    setIsLoadedFromSave(true);
    setInitialSlotsSnapshot({ ...sim.initialSlots });
    const lastWindow = sim.windows[sim.windows.length - 1];
    const currentSlots = lastWindow ? { ...lastWindow.slotsAfter } : { ...sim.initialSlots };
    setSlots(currentSlots);
    setWindows([...sim.windows]);
    setPrepareMode(false);
    setPrepareSlotsPreview({});
    setLastCommittedWindow(null);
    setInitialized(true);
    const states: Record<string, SimulationPlayerState> = {};
    for (const state of Object.values(sim.playerStates)) {
      states[state.playerId] = { ...state };
    }
    setPlayerStates(states);
  }, []);

  const start = useCallback(() => setIsRunning(true), []);
  const stop = useCallback(() => setIsRunning(false), []);

  const reset = useCallback(() => {
    const initialSlots = initialSlotsRef.current;
    setIsRunning(false);
    setTotalSeconds(0);
    setHalf(1);
    setIsHalftime(false);
    setIsFinished(false);
    setIsLoadedFromSave(false);
    setSlots({ ...initialSlots });
    setWindows([]);
    setPrepareMode(false);
    setPrepareSlotsPreview({});
    setLastCommittedWindow(null);
    setPlayerStates(buildInitialPlayerStates(initialSlots));
  }, []);

  const jumpToMinute = useCallback((minute: number) => {
    setTotalSeconds(Math.max(0, Math.min(7200, minute * 60)));
  }, []);

  const advanceBy = useCallback((minutes: number) => {
    setTotalSeconds((prev) => Math.min(7200, prev + minutes * 60));
  }, []);

  const startSecondHalf = useCallback(() => {
    setHalf(2);
    setIsHalftime(false);
  }, []);

  const startHalftime = useCallback(() => {
    setIsHalftime(true);
  }, []);

  const finishMatch = useCallback(() => {
    setIsRunning(false);
    setIsFinished(true);
    setPrepareMode(false);
    setPrepareSlotsPreview({});
  }, []);

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
          // Swap: displaced player goes where dragged player came from
          next[fromSlotIndex] = currentOccupant;
        }
        // If fromSlotIndex is null (bench → field), current occupant returns to bench (slot freed)
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

  const commitWindow = useCallback(() => {
    const minute = currentMinuteRef.current;
    const currentSlots = slotsRef.current;
    const newSlots = prepareSlotsRef.current;
    const prevWindows = windowsRef.current;
    const prevPlayerStates = playerStatesRef.current;

    // Determine who enters / leaves
    const currentOnField = new Set(
      Object.values(currentSlots).filter(Boolean) as string[],
    );
    const newOnField = new Set(Object.values(newSlots).filter(Boolean) as string[]);
    const leaving = [...currentOnField].filter((pid) => !newOnField.has(pid));
    const entering = [...newOnField].filter((pid) => !currentOnField.has(pid));

    // Build swaps — pair entering[i] with leaving[i] to avoid orphans when field
    // players are moved around before a bench player fills their original slot.
    const swaps: SubstitutionSwap[] = entering.map((inPid, i) => {
      const entry = Object.entries(newSlots).find(([, pid]) => pid === inPid)!;
      const targetSlotIdx = parseInt(entry[0]);
      const outPid = leaving[i] ?? null;
      return { inPlayerId: inPid, outPlayerId: outPid, slotIndex: targetSlotIdx };
    });

    const currentHalf = halfRef.current;
    const currentIsHalftime = isHalftimeRef.current;
    // Halftime windows get windowIndex 0 and don’t count against quota
    const windowIndex = currentIsHalftime ? 0 : prevWindows.filter((w) => !w.isHalftime).length + 1;
    const newWindow: SubstitutionWindow = {
      windowIndex,
      minute,
      half: currentHalf,
      swaps,
      slotsAfter: { ...newSlots },
      ...(currentIsHalftime ? { isHalftime: true } : {}),
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

    // Remember running state so we can restore after dialog closes
    wasRunningRef.current = isRunningRef.current;

    setIsRunning(false);
    setPlayerStates(nextPlayerStates);
    setSlots({ ...newSlots });
    setWindows((prev) => [...prev, newWindow]);
    setPrepareMode(false);
    setPrepareSlotsPreview({});
    setLastCommittedWindow(newWindow);
  }, []);

  const dismissConfirmation = useCallback(() => {
    setLastCommittedWindow(null);
    if (wasRunningRef.current) {
      setIsRunning(true);
    }
  }, []);

  const toMatchSimulation = useCallback(
    (
      id: string,
      name: string,
      teamId: string,
      eventId: string,
      formationId: string,
    ): MatchSimulation => ({
      id,
      name,
      teamId,
      eventId,
      formationId,
      createdAt: new Date().toISOString(),
      savedAtMinute: currentMinuteRef.current,
      initialSlots: { ...initialSlotsRef.current },
      windows: [...windowsRef.current],
      playerStates: { ...playerStatesRef.current },
    }),
    [],
  );

  return {
    currentMinute,
    currentSecond,
    isRunning,
    half,
    isHalftime,
    slots,
    playerStates,
    playerMinutes,
    windows,
    prepareMode,
    prepareSlotsPreview,
    lastCommittedWindow,
    initialized,
    isFinished,
    isMatchOver,
    isLoadedFromSave,
    initialSlots: initialSlotsSnapshot,
    halfDuration,
    windowsTotal,
    windowsInSecondHalf,
    canOpenWindow,
    initSimulation,
    loadSimulation,
    start,
    stop,
    reset,
    finishMatch,
    setHalfDuration,
    jumpToMinute,
    advanceBy,
    startSecondHalf,
    startHalftime,
    startPrepare,
    cancelPrepare,
    movePreparePlayer,
    movePreparePlayerToBench,
    commitWindow,
    dismissConfirmation,
    toMatchSimulation,
  };
}
