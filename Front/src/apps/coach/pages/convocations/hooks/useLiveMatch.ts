import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  SimulationPlayerState,
  SubstitutionSwap,
  SubstitutionWindow,
} from "../components/simulation/simulation.types";
import type {
  CardEvent,
  FormationChangeEvent,
  GoalEvent,
  LiveMatchActionType,
  LiveMatchFinishPlayer,
  LiveMatchParticipationPayload,
  LiveMatchPhase,
  LiveMatchServerClock,
  LiveMatchServerState,
  StartingFormation,
  WindowRatingSnapshot,
} from "../components/simulation/liveMatch.types";
import { MAX_MATCH_DURATION_MINUTES } from "../components/simulation/liveMatch.types";
import {
  deleteMatchParticipation,
  getEventMinuteLimitSanctions,
  getMatchParticipation,
  type MinuteLimitSanction,
} from "../../../services/liveMatchService";
import {
  FORMATION_POSITIONS,
  FULL_TEAM_PLAYERS,
  MIN_ON_FIELD_PLAYERS,
  defaultReducedFormation,
} from "../../../types/formation";
import {
  getCardStatus,
  getExpelledIds,
  isExpelledStatus,
  relocateAfterExpulsion,
} from "../utils/expulsions";
import { computeElapsedSeconds } from "../utils/liveMatchClock";
import { useLiveMatchServerState } from "./useLiveMatchServerState";

export const MAX_TOTAL_WINDOWS = 4;
export const MAX_SECOND_HALF_WINDOWS = 3;

const MAX_CLOCK_SECONDS = 7200;
const SAVE_ERROR_MESSAGE = "Error al guardar los datos del partido. Inténtalo de nuevo.";
const ACTION_ERROR_MESSAGE = "No se ha podido guardar la última acción en el servidor. Revisa el partido.";
const LEGACY_BACKUP_PREFIX = "rffm_live";

/** Appends the HTTP status and the server's reason, when the failure carries them, to the given error message. */
function describeSaveFailure(error: unknown, baseMessage: string = SAVE_ERROR_MESSAGE): string {
  const response = (error as { response?: { status?: unknown; data?: { detail?: unknown } } } | null)?.response;
  const status = typeof response?.status === "number" ? response.status : null;
  if (status === null) return baseMessage;
  const detail = typeof response?.data?.detail === "string" ? response.data.detail.trim() : "";
  return `${baseMessage} (${status}${detail ? `: ${detail}` : ""})`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseJsonArray<T>(json: string | null | undefined, fallback: T[]): T[] {
  if (!json) return fallback;
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function parseJsonRecord<T>(json: string | null | undefined): T | null {
  if (!json) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    return typeof parsed === "object" && parsed !== null ? (parsed as T) : null;
  } catch {
    return null;
  }
}

function countsTowardQuota(window: SubstitutionWindow): boolean {
  return !window.isHalftime && !window.fillsEmptySlot;
}

function isInPlay(phase: LiveMatchPhase): boolean {
  return phase === "firstHalf" || phase === "halftime" || phase === "secondHalf";
}

function showSnackbar(message: string, severity: "error" | "warning"): void {
  window.dispatchEvent(new CustomEvent("rffm.show_snackbar", { detail: { message, severity } }));
}

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

/**
 * Shared leaving/entering diff + player-state remapping logic, used by both
 * `commitWindow` (substitutions) and `changeFormation` (mid-match tactical
 * changes) so the accumulated-minutes bookkeeping is not duplicated.
 */
function applySlotChange(
  currentSlots: Record<number, string | null>,
  newSlots: Record<number, string | null>,
  prevPlayerStates: Record<string, SimulationPlayerState>,
  minute: number,
): {
  nextPlayerStates: Record<string, SimulationPlayerState>;
  leaving: string[];
  entering: string[];
} {
  const currentOnField = new Set(Object.values(currentSlots).filter(Boolean) as string[]);
  const newOnField = new Set(Object.values(newSlots).filter(Boolean) as string[]);
  const leaving = [...currentOnField].filter((pid) => !newOnField.has(pid));
  const entering = [...newOnField].filter((pid) => !currentOnField.has(pid));

  const nextPlayerStates = { ...prevPlayerStates };
  for (const pid of leaving) {
    const state = nextPlayerStates[pid];
    if (state) {
      nextPlayerStates[pid] = {
        ...state,
        accumulatedMinutes: state.accumulatedMinutes + Math.max(0, minute - state.minuteEntered),
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

  return { nextPlayerStates, leaving, entering };
}

/** Freezes the minutes of every player still on the field at the given match minute. */
function freezePlayerStates(
  states: Record<string, SimulationPlayerState>,
  minute: number,
): Record<string, SimulationPlayerState> {
  const updated: Record<string, SimulationPlayerState> = {};
  for (const [pid, state] of Object.entries(states)) {
    updated[pid] = state.isOnField
      ? {
          ...state,
          accumulatedMinutes: state.accumulatedMinutes + Math.max(0, minute - state.minuteEntered),
          isOnField: false,
        }
      : { ...state };
  }
  return updated;
}

/** Chains partial scores from 0-0 over the goals sorted by minute. */
function chainGoalScores(list: GoalEvent[], isHomeTeam: boolean): GoalEvent[] {
  const sorted = list
    .map((g, i) => ({ g, i }))
    .sort((x, y) => x.g.minute - y.g.minute || x.i - y.i)
    .map((x) => x.g);
  let loc = 0;
  let vis = 0;
  return sorted.map((g) => {
    const gLocal = g.isOwnTeam ? isHomeTeam : !isHomeTeam;
    if (gLocal) loc++;
    else vis++;
    return { ...g, scoreAtMoment: { local: loc, visitor: vis } };
  });
}

/** Players and minutes played, the payload of the finish action. */
function finishPlayersOf(m: MatchModel, minute: number): LiveMatchFinishPlayer[] {
  return Object.entries(m.playerStates).map(([pid, state]) => {
    const isStarter = Object.values(m.initialSlots).includes(pid);
    const finalMinutes = state.isOnField
      ? state.accumulatedMinutes + Math.max(0, minute - state.minuteEntered)
      : state.accumulatedMinutes;
    return {
      teamPlayerId: pid,
      minutesPlayed: Math.round(finalMinutes),
      isStarter,
      enteredAtMinute: isStarter ? 0 : state.minuteEntered,
      exitedAtMinute: state.isOnField ? null : minute,
    };
  });
}

// ─── Server documents ────────────────────────────────────────────────────────

type ServerDocuments = {
  startingLineupJson: string;
  playersJson: string;
  substitutionWindowsJson: string;
  ratingSnapshotsJson: string;
  goalsJson: string;
  cardsJson: string;
  formationChangesJson: string;
};

type StartingLineupDocument = {
  formationId: string | null;
  formationName: string | null;
  slots: Record<number, string | null>;
};

type PlayersDocument = {
  slots: Record<number, string | null>;
  playerStates: Record<string, SimulationPlayerState>;
};

/** Serialises the local model into the server documents the backend stores as opaque JSON. */
function serializeDocuments(m: MatchModel): ServerDocuments {
  return {
    startingLineupJson: JSON.stringify({
      formationId: m.startingFormation?.id ?? null,
      formationName: m.startingFormation?.name ?? null,
      slots: m.initialSlots,
    } satisfies StartingLineupDocument),
    playersJson: JSON.stringify({ slots: m.slots, playerStates: m.playerStates } satisfies PlayersDocument),
    substitutionWindowsJson: JSON.stringify(m.windows),
    ratingSnapshotsJson: JSON.stringify(m.ratingSnapshots),
    goalsJson: JSON.stringify(m.goals),
    cardsJson: JSON.stringify(m.cards),
    formationChangesJson: JSON.stringify(m.formationChanges),
  };
}

/** Rebuilds the local model from a server state; `previous` keeps values the server has not stored yet. */
function modelFromServerState(s: LiveMatchServerState, previous: MatchModel): MatchModel {
  const lineup = parseJsonRecord<StartingLineupDocument>(s.matchData.startingLineupJson);
  const players = parseJsonRecord<PlayersDocument>(s.matchData.playersJson);
  const formationChanges = parseJsonArray<FormationChangeEvent>(s.matchData.formationChangesJson, []);
  const lastChange = formationChanges.at(-1);
  const startingFormation: StartingFormation | null =
    lineup?.formationId && lineup.formationName
      ? { id: lineup.formationId, name: lineup.formationName }
      : previous.startingFormation;

  return {
    matchPhase: s.phase,
    half: s.phase === "secondHalf" ? 2 : s.phase === "finished" ? previous.half : 1,
    isHalftime: s.phase === "halftime",
    initialSlots: lineup?.slots ?? previous.initialSlots,
    startingFormation,
    currentFormation: lastChange
      ? { id: lastChange.formationId, name: lastChange.formationName }
      : startingFormation,
    slots: players?.slots ?? previous.slots,
    playerStates: players?.playerStates ?? previous.playerStates,
    windows: parseJsonArray<SubstitutionWindow>(s.matchData.substitutionWindowsJson, []),
    ratingSnapshots: parseJsonArray<WindowRatingSnapshot>(s.matchData.ratingSnapshotsJson, []),
    goals: parseJsonArray<GoalEvent>(s.matchData.goalsJson, []),
    cards: parseJsonArray<CardEvent>(s.matchData.cardsJson, []),
    formationChanges,
    scoreLocal: s.scoreLocal,
    scoreVisitor: s.scoreVisitor,
    matchDurationMinutes:
      previous.matchDurationMinutes ?? (s.phase === "preMatch" ? null : s.matchDurationMinutes),
  };
}

function savedParticipationOf(s: LiveMatchServerState, m: MatchModel): LiveMatchParticipationPayload {
  const minute = Math.floor(s.clock.baseSeconds / 60);
  const documents = serializeDocuments(m);
  return {
    teamId: s.teamId,
    scoreLocal: s.scoreLocal,
    scoreVisitor: s.scoreVisitor,
    matchPhase: "finished",
    players: finishPlayersOf(m, minute),
    substitutionWindowsJson: documents.substitutionWindowsJson,
    ratingSnapshotsJson: documents.ratingSnapshotsJson,
    goalsJson: documents.goalsJson,
    cardsJson: documents.cardsJson,
    formationChangesJson: documents.formationChangesJson,
    matchDurationMinutes: m.matchDurationMinutes,
    startingLineupJson: documents.startingLineupJson,
  };
}

// ─── Model ───────────────────────────────────────────────────────────────────

type MatchModel = {
  matchPhase: LiveMatchPhase;
  half: 1 | 2;
  isHalftime: boolean;
  initialSlots: Record<number, string | null>;
  startingFormation: StartingFormation | null;
  currentFormation: StartingFormation | null;
  slots: Record<number, string | null>;
  playerStates: Record<string, SimulationPlayerState>;
  windows: SubstitutionWindow[];
  ratingSnapshots: WindowRatingSnapshot[];
  goals: GoalEvent[];
  cards: CardEvent[];
  formationChanges: FormationChangeEvent[];
  scoreLocal: number;
  scoreVisitor: number;
  matchDurationMinutes: number | null;
};

const INITIAL_MODEL: MatchModel = {
  matchPhase: "preMatch",
  half: 1,
  isHalftime: false,
  initialSlots: {},
  startingFormation: null,
  currentFormation: null,
  slots: {},
  playerStates: {},
  windows: [],
  ratingSnapshots: [],
  goals: [],
  cards: [],
  formationChanges: [],
  scoreLocal: 0,
  scoreVisitor: 0,
  matchDurationMinutes: null,
};

type ServerStep = { type: LiveMatchActionType; payload?: Record<string, unknown> };

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
  /** Sets the final result directly, independent of the goals list (used when the
   * coach knows the score but not who scored or at what minute) */
  setScore: (scoreLocal: number, scoreVisitor: number) => void;
  // Cards
  cards: CardEvent[];
  // Formation changes
  formationChanges: FormationChangeEvent[];
  /** Formation currently on the field (starting one until a change or an expulsion) */
  currentFormation: StartingFormation | null;
  /** Own-team card that would leave fewer than 7 players; waits for the coach to confirm ending the match */
  pendingMinPlayersCard: CardEvent | null;
  confirmMinPlayersEnd: () => void;
  cancelMinPlayersEnd: () => void;
  // Unlimited substitution windows (friendlies)
  unlimitedWindows: boolean;
  // Rating snapshots
  ratingSnapshots: WindowRatingSnapshot[];
  // Pending confirmation
  pendingAction: PendingAction;
  setPendingAction: (action: PendingAction) => void;
  adjustClock: (deltaMinutes: number) => void;
  // Save state
  isSaving: boolean;
  saveError: string | null;
  /** Retries the end-of-match save after a failure */
  retrySave: () => void;
  // Persisted data (when match has been saved before)
  hasSavedData: boolean;
  savedParticipationData: LiveMatchParticipationPayload | null;
  /** Duración real del partido; se rellena al terminar y se puede corregir. */
  matchDurationMinutes: number | null;
  setMatchDuration: (minutes: number) => void;
  isDeleting: boolean;
  deleteParticipation: () => Promise<void>;
  // Connection
  isOnline: boolean;
  /** "loading" until the first server read settles; "offline" when the hub is down or the read failed */
  serverStatus: "loading" | "ready" | "offline";
  /** Version of the server state the screen shows; null before the state is loaded */
  serverVersion: number | null;
  // Actions
  initMatch: (initialSlots: Record<number, string | null>, startingFormation?: StartingFormation | null) => void;
  confirmAction: () => void;
  cancelAction: () => void;
  addGoal: (
    scorerId: string | null,
    scorerName: string | null,
    scorerDorsal: number | null,
    isOwnTeam: boolean,
    pitchZone?: { col: number; row: number } | null,
    bodyPart?: "head" | "foot" | null,
    minute?: number,
  ) => void;
  removeGoal: (goalId: string) => void;
  updateGoal: (goalId: string, patch: Partial<Omit<GoalEvent, "id">>) => void;
  addCard: (
    teamPlayerId: string | null,
    playerName: string | null,
    isRivalPlayer: boolean,
    rivalDorsal: number | null,
    cardType: "yellow" | "red",
    minute?: number,
    half?: 1 | 2,
  ) => void;
  removeCard: (cardId: string) => void;
  updateCard: (cardId: string, patch: Partial<Omit<CardEvent, "id">>) => void;
  changeFormation: (
    formationId: string,
    formationName: string,
    newSlots: Record<number, string | null>,
  ) => void;
  startPrepare: () => void;
  cancelPrepare: () => void;
  movePreparePlayer: (draggedId: string, fromSlotIndex: number | null, targetSlotIndex: number) => void;
  movePreparePlayerToBench: (draggedId: string, fromSlotIndex: number) => void;
  commitWindow: (ratingsByPlayerId: Record<string, number | null>) => void;
  /**
   * Swaps two on-field players' positions directly, without opening a
   * substitution window — no bench player is involved, so it doesn't count
   * as a substitution and requires no "preparar cambio" step.
   */
  repositionPlayer: (fromSlotIndex: number, toSlotIndex: number) => void;
  /** Replaces the recorded substitution windows with the ones corrected in the manual edit */
  replaceWindows: (windows: SubstitutionWindow[]) => void;
  dismissConfirmation: () => void;
  dismissSaveError: () => void;
}

export type PendingAction =
  | "startMatch"
  | "endFirstHalf"
  | "startSecondHalf"
  | "endMatch"
  | null;

export interface UseLiveMatchOptions {
  /** When true (friendly matches), the substitution-window quota is not enforced */
  unlimitedWindows?: boolean;
  /** Optional player id -> display name lookup, used only to name players in the
   * minute-limit sanction warning (falls back to the raw teamPlayerId when omitted). */
  players?: { id: string; displayName: string }[];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLiveMatch(
  eventId: string | null,
  teamId: string,
  isHomeTeam = true,
  options: UseLiveMatchOptions = {},
): UseLiveMatchReturn {
  const { unlimitedWindows = false, players: playersOption } = options;
  const live = useLiveMatchServerState(eventId ?? undefined);

  const liveRef = useRef(live);
  liveRef.current = live;
  const serverStateRef = useRef<LiveMatchServerState | null>(null);
  serverStateRef.current = live.state;
  const serverOffsetRef = useRef(0);
  serverOffsetRef.current = live.serverOffsetMs;
  const eventIdRef = useRef(eventId);
  eventIdRef.current = eventId;
  const teamIdRef = useRef(teamId);
  teamIdRef.current = teamId;
  const isHomeTeamRef = useRef(isHomeTeam);
  isHomeTeamRef.current = isHomeTeam;
  const playersOptionRef = useRef(playersOption);
  playersOptionRef.current = playersOption;

  // ── Model (displayed) and its synchronous mirror (read by actions) ───────
  const [model, setModel] = useState<MatchModel>(INITIAL_MODEL);
  const modelRef = useRef<MatchModel>(INITIAL_MODEL);
  const commitModel = useCallback((next: MatchModel) => {
    modelRef.current = next;
    setModel(next);
  }, []);

  // ── Clock: server clock reference, re-rendered once per second while running
  const [totalSeconds, setTotalSeconds] = useState(0);
  const clockRef = useRef<LiveMatchServerClock>({ baseSeconds: 0, referenceUtc: null });

  // ── Screen-only state ─────────────────────────────────────────────────────
  const [halfDuration, setHalfDurationState] = useState(45);
  const halfDurationRef = useRef(45);
  halfDurationRef.current = halfDuration;
  const [prepareMode, setPrepareMode] = useState(false);
  const prepareModeRef = useRef(false);
  prepareModeRef.current = prepareMode;
  const [prepareSlotsPreview, setPrepareSlotsPreview] = useState<Record<number, string | null>>({});
  const prepareSlotsRef = useRef<Record<number, string | null>>({});
  prepareSlotsRef.current = prepareSlotsPreview;
  const [lastCommittedWindow, setLastCommittedWindow] = useState<SubstitutionWindow | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [pendingMinPlayersCard, setPendingMinPlayersCard] = useState<CardEvent | null>(null);
  const pendingMinPlayersCardRef = useRef<CardEvent | null>(null);
  pendingMinPlayersCardRef.current = pendingMinPlayersCard;
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasSavedData, setHasSavedData] = useState(false);
  const [savedParticipationData, setSavedParticipationData] = useState<LiveMatchParticipationPayload | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const legacyHydratedRef = useRef(false);

  // ── Minute-limit sportive sanctions (warn the coach when a cap is reached) ──
  const [minuteLimitSanctions, setMinuteLimitSanctions] = useState<MinuteLimitSanction[]>([]);
  const notifiedMinuteLimitPlayersRef = useRef<Set<string>>(new Set());

  // ── Reconciliation bookkeeping ───────────────────────────────────────────
  // While a chain of actions is in flight, or a finish is awaiting a retry, the local model is
  // ahead of the server, so server states are not applied over it.
  const [reconcileTick, setReconcileTick] = useState(0);
  const inFlightRef = useRef(0);
  const finishPendingRef = useRef<LiveMatchFinishPlayer[] | null>(null);
  const hadServerStateRef = useRef(false);

  const {
    matchPhase,
    half,
    isHalftime,
    initialSlots,
    slots,
    playerStates,
    windows,
    ratingSnapshots,
    goals,
    cards,
    formationChanges,
    currentFormation,
    scoreLocal,
    scoreVisitor,
    matchDurationMinutes,
  } = model;

  // ── Derived ───────────────────────────────────────────────────────────────

  const currentMinute = Math.floor(totalSeconds / 60);
  const currentSecond = totalSeconds % 60;
  const isRunning = matchPhase === "firstHalf" || matchPhase === "secondHalf";

  const windowsTotal = windows.filter(countsTowardQuota).length;
  const windowsInSecondHalf = windows.filter((w) => w.half === 2 && countsTowardQuota(w)).length;
  const canOpenWindow =
    !prepareMode &&
    (matchPhase === "firstHalf" ||
      matchPhase === "secondHalf" ||
      matchPhase === "halftime") &&
    (isHalftime ||
      unlimitedWindows ||
      (windowsTotal < MAX_TOTAL_WINDOWS &&
        (half === 1 || windowsInSecondHalf < MAX_SECOND_HALF_WINDOWS)));

  const playerMinutes = useMemo(() => {
    const result: Record<string, number> = {};
    for (const [pid, state] of Object.entries(playerStates)) {
      result[pid] = state.isOnField
        ? state.accumulatedMinutes + Math.max(0, currentMinute - state.minuteEntered)
        : state.accumulatedMinutes;
    }
    return result;
  }, [playerStates, currentMinute]);

  // ── Server clock ──────────────────────────────────────────────────────────

  const computeCurrentTotalSeconds = useCallback(
    (): number =>
      Math.min(MAX_CLOCK_SECONDS, computeElapsedSeconds(clockRef.current, serverOffsetRef.current, Date.now())),
    [],
  );

  /** Server-time ISO instant for a clock reference, using the offset from the last applied state. */
  const nowServerIso = useCallback(
    (): string => new Date(Date.now() + serverOffsetRef.current).toISOString(),
    [],
  );

  useEffect(() => {
    if (!isRunning) return undefined;
    const id = setInterval(() => setTotalSeconds(computeCurrentTotalSeconds()), 1000);
    return () => clearInterval(id);
  }, [isRunning, computeCurrentTotalSeconds]);

  // ── Server reconciliation ─────────────────────────────────────────────────

  const resetToPreMatch = useCallback(() => {
    const m = modelRef.current;
    clockRef.current = { baseSeconds: 0, referenceUtc: null };
    setTotalSeconds(0);
    commitModel({
      ...m,
      matchPhase: "preMatch",
      half: 1,
      isHalftime: false,
      slots: { ...m.initialSlots },
      playerStates: buildInitialPlayerStates(m.initialSlots),
      windows: [],
      ratingSnapshots: [],
      goals: [],
      cards: [],
      formationChanges: [],
      scoreLocal: 0,
      scoreVisitor: 0,
      currentFormation: m.startingFormation,
      matchDurationMinutes: null,
    });
    setPrepareMode(false);
    setPrepareSlotsPreview({});
    setLastCommittedWindow(null);
    setPendingMinPlayersCard(null);
    setHasSavedData(false);
    setSavedParticipationData(null);
    setSaveError(null);
  }, [commitModel]);

  const applyServerState = useCallback(
    (s: LiveMatchServerState) => {
      const next = modelFromServerState(s, modelRef.current);
      commitModel(next);
      clockRef.current = s.clock;
      setTotalSeconds(computeCurrentTotalSeconds());
      setInitialized(true);
      if (s.phase === "finished") {
        setHasSavedData(true);
        setSavedParticipationData(savedParticipationOf(s, next));
      } else {
        setHasSavedData(false);
        setSavedParticipationData(null);
      }
    },
    [commitModel, computeCurrentTotalSeconds],
  );

  useEffect(() => {
    if (inFlightRef.current > 0 || finishPendingRef.current !== null) return;
    const s = live.state;
    if (s === null) {
      if (hadServerStateRef.current) {
        hadServerStateRef.current = false;
        resetToPreMatch();
      }
      return;
    }
    hadServerStateRef.current = true;
    applyServerState(s);
  }, [live.state, reconcileTick, applyServerState, resetToPreMatch]);

  // D10: a legacy localStorage backup is dropped once the event is known to have no server state.
  useEffect(() => {
    if (!eventId || live.status === "loading" || live.state !== null) return;
    localStorage.removeItem(`${LEGACY_BACKUP_PREFIX}:${eventId}`);
  }, [eventId, live.status, live.state]);

  const hydrateFromSavedParticipation = useCallback(
    (data: LiveMatchParticipationPayload) => {
      legacyHydratedRef.current = true;
      commitModel({
        ...modelRef.current,
        matchPhase: "finished",
        isHalftime: false,
        scoreLocal: data.scoreLocal,
        scoreVisitor: data.scoreVisitor,
        goals: parseJsonArray<GoalEvent>(data.goalsJson, []),
        cards: parseJsonArray<CardEvent>(data.cardsJson, []),
        windows: parseJsonArray<SubstitutionWindow>(data.substitutionWindowsJson, []),
        formationChanges: parseJsonArray<FormationChangeEvent>(data.formationChangesJson, []),
        ratingSnapshots: parseJsonArray<WindowRatingSnapshot>(data.ratingSnapshotsJson, []),
        matchDurationMinutes: data.matchDurationMinutes ?? null,
      });
      setHasSavedData(true);
      setSavedParticipationData(data);
    },
    [commitModel],
  );

  // Legacy read: a finished match saved before server state exists.
  useEffect(() => {
    if (!eventId) return;
    let mounted = true;
    getMatchParticipation(eventId)
      .then((data) => {
        if (!mounted || serverStateRef.current !== null) return;
        if (data && data.matchPhase === "finished") hydrateFromSavedParticipation(data);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [eventId, hydrateFromSavedParticipation]);

  // ── Load active minute-limit sportive sanctions for this event ──────────
  // Fetched once per event (design.md Decisión 9 — no polling, minutes are
  // already tracked client-side and compared locally on every tick below).

  useEffect(() => {
    notifiedMinuteLimitPlayersRef.current = new Set();
    if (!eventId) {
      setMinuteLimitSanctions([]);
      return;
    }
    let mounted = true;
    getEventMinuteLimitSanctions(eventId)
      .then((list) => {
        if (mounted) setMinuteLimitSanctions(list);
      })
      .catch(() => {
        if (mounted) setMinuteLimitSanctions([]);
      });
    return () => {
      mounted = false;
    };
  }, [eventId]);

  // ── Warn the coach when a sanctioned player reaches their minute cap ────

  useEffect(() => {
    if (minuteLimitSanctions.length === 0) return;
    for (const sanction of minuteLimitSanctions) {
      const minutesPlayed = playerMinutes[sanction.teamPlayerId];
      if (minutesPlayed == null) continue;
      if (minutesPlayed < sanction.minutesLimit) continue;
      if (notifiedMinuteLimitPlayersRef.current.has(sanction.teamPlayerId)) continue;

      notifiedMinuteLimitPlayersRef.current.add(sanction.teamPlayerId);
      const playerName =
        playersOptionRef.current?.find((p) => p.id === sanction.teamPlayerId)?.displayName ??
        sanction.teamPlayerId;
      showSnackbar(
        `${playerName} ha alcanzado su límite de minutos por sanción deportiva (${sanction.minutesLimit}'). Debe salir del terreno de juego.`,
        "warning",
      );
    }
  }, [playerMinutes, minuteLimitSanctions]);

  // ── Server calls ──────────────────────────────────────────────────────────

  /** Document-carrying payload for a model-changing action, built from the local model right now. */
  const modelPayload = (extra?: Record<string, unknown>): Record<string, unknown> => {
    const m = modelRef.current;
    return { scoreLocal: m.scoreLocal, scoreVisitor: m.scoreVisitor, documents: serializeDocuments(m), ...extra };
  };

  /** Sends a model-changing action only when the match is in play; before kick-off and after the end the screen stays local. */
  const sendIfInPlay = (type: LiveMatchActionType, extra?: Record<string, unknown>) => {
    if (!isInPlay(modelRef.current.matchPhase)) return;
    void runServerSteps([{ type, payload: modelPayload(extra) }]);
  };

  const sendSteps = useCallback(async (steps: ServerStep[]): Promise<boolean> => {
    for (const step of steps) {
      const result = await liveRef.current.send(step.type, step.payload);
      if (!result.ok) return false;
    }
    return true;
  }, []);

  /**
   * Sends a chain in order; a failure stops the chain and the next server state reconciles the screen.
   * The live match is created lazily, by the first write, so a screen that only reads (for example a
   * legacy finished match) never gets a server state of its own.
   */
  const runServerSteps = useCallback(
    async (steps: ServerStep[]): Promise<void> => {
      inFlightRef.current += 1;
      try {
        if (serverStateRef.current === null) await liveRef.current.ensureCreated();
        await sendSteps(steps);
      } catch (error) {
        showSnackbar(describeSaveFailure(error, ACTION_ERROR_MESSAGE), "error");
      } finally {
        inFlightRef.current -= 1;
        setReconcileTick((tick) => tick + 1);
      }
    },
    [sendSteps],
  );

  /**
   * Steps that bring a server match in the given phase up to the second half, carrying the screen's
   * documents so that the finish stores the real lineup, goals, cards and substitutions.
   */
  const stepsToSecondHalf = (phase: LiveMatchPhase): ServerStep[] => {
    const m = modelRef.current;
    const endAndResume: ServerStep[] = [{ type: "endHalf" }, { type: "startSecondHalf" }];
    if (phase === "halftime") return [{ type: "startSecondHalf" }];
    if (phase === "firstHalf") return endAndResume;
    if (phase !== "preMatch") return [];
    const duration = m.matchDurationMinutes;
    return [
      ...(duration !== null && duration > 0 ? [{ type: "setDuration", payload: { durationMinutes: duration } } as ServerStep] : []),
      { type: "setLineup", payload: { formation: m.startingFormation?.name, documents: serializeDocuments(m) } },
      { type: "kickOff" },
      { type: "goal", payload: modelPayload() },
      { type: "card", payload: modelPayload() },
      { type: "substitution", payload: modelPayload() },
      { type: "formationChange", payload: modelPayload() },
      ...endAndResume,
    ];
  };

  /**
   * Runs the transitions still needed and then the finish; a failure keeps the screen data and offers a retry.
   * When the server has no match yet (or is behind the screen, e.g. a retry), it is created and caught up first.
   */
  const runFinish = useCallback(
    async (steps: ServerStep[], players: LiveMatchFinishPlayer[]): Promise<void> => {
      finishPendingRef.current = players;
      inFlightRef.current += 1;
      setIsSaving(true);
      setSaveError(null);
      let saved = false;
      let failureMessage = SAVE_ERROR_MESSAGE;
      try {
        const serverMissing = serverStateRef.current === null;
        const serverPhase: LiveMatchPhase = serverStateRef.current?.phase ?? "preMatch";
        if (serverMissing) await liveRef.current.ensureCreated();
        const serverIsBehind = serverPhase === "preMatch" || (steps.length === 0 && serverPhase !== "secondHalf");
        const stepsToSend = serverIsBehind ? stepsToSecondHalf(serverPhase) : steps;
        const transitioned = await sendSteps(stepsToSend);
        if (transitioned) saved = (await liveRef.current.finish(players)).ok;
      } catch (error) {
        saved = false;
        failureMessage = describeSaveFailure(error);
      } finally {
        inFlightRef.current -= 1;
        setIsSaving(false);
      }
      if (saved) finishPendingRef.current = null;
      else setSaveError(failureMessage);
      setReconcileTick((tick) => tick + 1);
    },
    [sendSteps],
  );

  // ── Phase transitions ─────────────────────────────────────────────────────

  const startMatchLocally = () => {
    const m = modelRef.current;
    const steps: ServerStep[] = [
      { type: "setLineup", payload: { formation: m.startingFormation?.name, documents: serializeDocuments(m) } },
      { type: "kickOff" },
    ];
    clockRef.current = { baseSeconds: 0, referenceUtc: nowServerIso() };
    setTotalSeconds(0);
    commitModel({
      ...m,
      matchPhase: "firstHalf",
      half: 1,
      isHalftime: false,
      playerStates: buildInitialPlayerStates(m.initialSlots, 0),
    });
    // A score set before kick-off stays local until the match is in play; one goal action carries it.
    const started = modelRef.current;
    if (started.scoreLocal > 0 || started.scoreVisitor > 0) steps.push({ type: "goal", payload: modelPayload() });
    void runServerSteps(steps);
  };

  const endFirstHalfLocally = () => {
    const frozen = computeCurrentTotalSeconds();
    clockRef.current = { baseSeconds: frozen, referenceUtc: null };
    setTotalSeconds(frozen);
    commitModel({ ...modelRef.current, matchPhase: "halftime", isHalftime: true, half: 1 });
    void runServerSteps([{ type: "endHalf" }]);
  };

  const startSecondHalfLocally = () => {
    clockRef.current = { baseSeconds: clockRef.current.baseSeconds, referenceUtc: nowServerIso() };
    commitModel({ ...modelRef.current, matchPhase: "secondHalf", isHalftime: false, half: 2 });
    void runServerSteps([{ type: "startSecondHalf" }]);
  };

  /** Ends the match: freezes the clock, then sends the transitions still missing and the finish. */
  const finishMatchLocally = (leadingSteps: ServerStep[] = []) => {
    const m = modelRef.current;
    const frozen = computeCurrentTotalSeconds();
    const minute = Math.floor(frozen / 60);
    const players = finishPlayersOf(m, minute);
    const transitions: ServerStep[] =
      m.matchPhase === "firstHalf"
        ? [{ type: "endHalf" }, { type: "startSecondHalf" }]
        : m.matchPhase === "halftime"
          ? [{ type: "startSecondHalf" }]
          : [];

    clockRef.current = { baseSeconds: frozen, referenceUtc: null };
    setTotalSeconds(frozen);
    // Duración real = minuto final del cronómetro (partes + añadido); sin cronómetro, 2 × parte.
    commitModel({
      ...m,
      matchPhase: "finished",
      isHalftime: false,
      playerStates: freezePlayerStates(m.playerStates, minute),
      matchDurationMinutes: Math.floor(frozen / 60) || 2 * halfDurationRef.current,
    });
    setPrepareMode(false);
    setPrepareSlotsPreview({});
    void runFinish([...leadingSteps, ...transitions], players);
  };

  // ── Confirmation flow ─────────────────────────────────────────────────────

  const confirmAction = useCallback(() => {
    const action = pendingAction;
    setPendingAction(null);

    switch (action) {
      case "startMatch":
        startMatchLocally();
        break;
      case "endFirstHalf":
        endFirstHalfLocally();
        break;
      case "startSecondHalf":
        startSecondHalfLocally();
        break;
      case "endMatch":
        finishMatchLocally();
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAction]);

  const cancelAction = useCallback(() => {
    setPendingAction(null);
  }, []);

  /** Adelanta (+) o retrasa (−) el reloj en vivo; el valor lo fija el servidor al responder. */
  const adjustClock = useCallback(
    (deltaMinutes: number) => {
      if (!isInPlay(modelRef.current.matchPhase) || modelRef.current.matchPhase === "halftime") return;
      const next = Math.max(0, Math.min(MAX_CLOCK_SECONDS, computeCurrentTotalSeconds() + deltaMinutes * 60));
      clockRef.current = { baseSeconds: next, referenceUtc: nowServerIso() };
      setTotalSeconds(next);
      void runServerSteps([{ type: "adjustClock", payload: { deltaSeconds: deltaMinutes * 60 } }]);
    },
    [computeCurrentTotalSeconds, nowServerIso, runServerSteps],
  );

  // ── Initialization and deletion ───────────────────────────────────────────

  const initMatch = useCallback(
    (newInitialSlots: Record<number, string | null>, startingFormation?: StartingFormation | null) => {
      notifiedMinuteLimitPlayersRef.current = new Set();
      setSaveError(null);
      const server = serverStateRef.current;
      // The server is authoritative once the match has started or has been closed.
      if ((server !== null && server.phase !== "preMatch") || legacyHydratedRef.current) {
        setInitialized(true);
        return;
      }
      commitModel({
        ...modelRef.current,
        matchPhase: "preMatch",
        half: 1,
        isHalftime: false,
        initialSlots: { ...newInitialSlots },
        startingFormation: startingFormation ?? null,
        currentFormation: startingFormation ?? null,
        slots: { ...newInitialSlots },
        playerStates: buildInitialPlayerStates(newInitialSlots),
        windows: [],
        ratingSnapshots: [],
        goals: [],
        cards: [],
        formationChanges: [],
        scoreLocal: 0,
        scoreVisitor: 0,
        matchDurationMinutes: null,
      });
      clockRef.current = { baseSeconds: 0, referenceUtc: null };
      setTotalSeconds(0);
      setPendingMinPlayersCard(null);
      setPrepareMode(false);
      setPrepareSlotsPreview({});
      setLastCommittedWindow(null);
      setInitialized(true);
    },
    [commitModel],
  );

  const deleteParticipation = useCallback(async () => {
    const eid = eventIdRef.current;
    const tid = teamIdRef.current;
    if (!eid || !tid) return;
    setIsDeleting(true);
    try {
      if (serverStateRef.current !== null) {
        await liveRef.current.remove();
      } else {
        await deleteMatchParticipation(eid, tid);
      }
      resetToPreMatch();
    } catch {
      showSnackbar("No se ha podido eliminar el partido. Inténtalo de nuevo.", "error");
    } finally {
      setIsDeleting(false);
    }
  }, [resetToPreMatch]);

  const retrySave = useCallback(() => {
    const players = finishPendingRef.current;
    if (players) void runFinish([], players);
  }, [runFinish]);

  const dismissSaveError = useCallback(() => setSaveError(null), []);

  // ── Goals ─────────────────────────────────────────────────────────────────

  /** Writes goals and the score deltas they imply, then sends the goal action when the match is in play. */
  const writeGoals = (
    rawGoals: GoalEvent[],
    scoreChanges: Array<{ isOwnTeam: boolean; delta: 1 | -1 }>,
  ) => {
    const m = modelRef.current;
    let nextLocal = m.scoreLocal;
    let nextVisitor = m.scoreVisitor;
    for (const change of scoreChanges) {
      const isLocal = change.isOwnTeam ? isHomeTeamRef.current : !isHomeTeamRef.current;
      if (isLocal) nextLocal = Math.max(0, nextLocal + change.delta);
      else nextVisitor = Math.max(0, nextVisitor + change.delta);
    }
    commitModel({
      ...m,
      goals: chainGoalScores(rawGoals, isHomeTeamRef.current),
      scoreLocal: nextLocal,
      scoreVisitor: nextVisitor,
    });
    sendIfInPlay("goal");
  };

  const addGoal = useCallback(
    (
      scorerId: string | null,
      scorerName: string | null,
      scorerDorsal: number | null,
      isOwnTeam: boolean,
      pitchZone: { col: number; row: number } | null = null,
      bodyPart: "head" | "foot" | null = null,
      minute?: number,
    ) => {
      const goal: GoalEvent = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        minute: minute ?? Math.floor(computeCurrentTotalSeconds() / 60),
        scorerId,
        scorerName,
        scorerDorsal,
        isOwnTeam,
        scoreAtMoment: { local: 0, visitor: 0 },
        pitchZone,
        bodyPart,
      };
      writeGoals([...modelRef.current.goals, goal], [{ isOwnTeam, delta: 1 }]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const setMatchDuration = useCallback(
    (minutes: number) => {
      const value = Math.min(MAX_MATCH_DURATION_MINUTES, Math.max(0, Math.round(minutes)));
      commitModel({ ...modelRef.current, matchDurationMinutes: value });
      if (modelRef.current.matchPhase === "preMatch" && value >= 1) {
        void runServerSteps([{ type: "setDuration", payload: { durationMinutes: value } }]);
      }
    },
    [commitModel, runServerSteps],
  );

  const setScore = useCallback(
    (newScoreLocal: number, newScoreVisitor: number) => {
      commitModel({
        ...modelRef.current,
        scoreLocal: Math.max(0, Math.round(newScoreLocal)),
        scoreVisitor: Math.max(0, Math.round(newScoreVisitor)),
      });
      sendIfInPlay("goal");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commitModel],
  );

  const removeGoal = useCallback(
    (goalId: string) => {
      const removed = modelRef.current.goals.find((g) => g.id === goalId);
      if (!removed) return;
      writeGoals(
        modelRef.current.goals.filter((g) => g.id !== goalId),
        [{ isOwnTeam: removed.isOwnTeam, delta: -1 }],
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const updateGoal = useCallback(
    (goalId: string, patch: Partial<Omit<GoalEvent, "id">>) => {
      const oldGoal = modelRef.current.goals.find((g) => g.id === goalId);
      if (!oldGoal) return;
      const newGoal = { ...oldGoal, ...patch };
      const scoreChanges: Array<{ isOwnTeam: boolean; delta: 1 | -1 }> =
        oldGoal.isOwnTeam !== newGoal.isOwnTeam
          ? [
              { isOwnTeam: oldGoal.isOwnTeam, delta: -1 },
              { isOwnTeam: newGoal.isOwnTeam, delta: 1 },
            ]
          : [];
      writeGoals(
        modelRef.current.goals.map((g) => (g.id === goalId ? newGoal : g)),
        scoreChanges,
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ── Cards ─────────────────────────────────────────────────────────────────

  const registerCardLocally = (card: CardEvent) => {
    commitModel({ ...modelRef.current, cards: [...modelRef.current.cards, card] });
  };

  /** Takes a sent-off player off the field and applies a formation for the players the team may field. */
  const sendOffLocally = (playerId: string) => {
    const m = modelRef.current;
    const allowedPlayers = FULL_TEAM_PLAYERS - getExpelledIds(m.cards).size;
    const formation = defaultReducedFormation(allowedPlayers, m.currentFormation?.name ?? null);
    const newSlots = relocateAfterExpulsion(m.slots, playerId, FORMATION_POSITIONS[formation.name] ?? []);
    setPrepareMode(false);
    setPrepareSlotsPreview({});
    applyFormationChangeLocally(formation.id, formation.name, newSlots);
  };

  const addCard = useCallback(
    (
      teamPlayerId: string | null,
      playerName: string | null,
      isRivalPlayer: boolean,
      rivalDorsal: number | null,
      cardType: "yellow" | "red",
      minute?: number,
      half?: 1 | 2,
    ) => {
      const m = modelRef.current;
      const card: CardEvent = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        minute: minute ?? Math.floor(computeCurrentTotalSeconds() / 60),
        half: half ?? m.half,
        cardType,
        teamPlayerId,
        playerName,
        isRivalPlayer,
        rivalDorsal,
      };

      const onFieldIds = Object.values(m.slots).filter(Boolean) as string[];
      const sendsOffOnFieldPlayer =
        !isRivalPlayer &&
        teamPlayerId !== null &&
        isInPlay(m.matchPhase) &&
        onFieldIds.includes(teamPlayerId) &&
        isExpelledStatus(getCardStatus([...m.cards, card], teamPlayerId));

      if (!sendsOffOnFieldPlayer || teamPlayerId === null) {
        registerCardLocally(card);
        sendIfInPlay("card");
        return;
      }

      const leavesTooFewPlayers = onFieldIds.length - 1 < MIN_ON_FIELD_PLAYERS;
      if (leavesTooFewPlayers) {
        setPendingMinPlayersCard(card);
        return;
      }

      registerCardLocally(card);
      sendOffLocally(teamPlayerId);
      sendIfInPlay("card");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const confirmMinPlayersEnd = useCallback(() => {
    const card = pendingMinPlayersCardRef.current;
    if (!card?.teamPlayerId) return;
    const expelledId = card.teamPlayerId;
    setPendingMinPlayersCard(null);

    const m = modelRef.current;
    const newSlots: Record<number, string | null> = {};
    for (const [slotIdx, pid] of Object.entries(m.slots)) {
      newSlots[parseInt(slotIdx)] = pid === expelledId ? null : pid;
    }
    const { nextPlayerStates } = applySlotChange(
      m.slots,
      newSlots,
      m.playerStates,
      Math.floor(computeCurrentTotalSeconds() / 60),
    );
    commitModel({
      ...m,
      cards: [...m.cards, card],
      slots: newSlots,
      playerStates: nextPlayerStates,
    });
    finishMatchLocally([{ type: "card", payload: modelPayload() }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commitModel, computeCurrentTotalSeconds]);

  const cancelMinPlayersEnd = useCallback(() => {
    setPendingMinPlayersCard(null);
  }, []);

  const removeCard = useCallback(
    (cardId: string) => {
      commitModel({ ...modelRef.current, cards: modelRef.current.cards.filter((c) => c.id !== cardId) });
      sendIfInPlay("card");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commitModel],
  );

  const updateCard = useCallback(
    (cardId: string, patch: Partial<Omit<CardEvent, "id">>) => {
      const m = modelRef.current;
      const idx = m.cards.findIndex((c) => c.id === cardId);
      if (idx === -1) return;
      commitModel({
        ...m,
        cards: m.cards.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
      });
      sendIfInPlay("card");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commitModel],
  );

  // ── Mid-match formation change ───────────────────────────────────────────

  function applyFormationChangeLocally(
    formationId: string,
    formationName: string,
    newSlots: Record<number, string | null>,
  ) {
    const m = modelRef.current;
    const minute = Math.floor(computeCurrentTotalSeconds() / 60);
    const { nextPlayerStates } = applySlotChange(m.slots, newSlots, m.playerStates, minute);
    // Unlike a substitution window, a formation change can also reposition
    // players who remain on the field into a different slot index.
    for (const [slotIdxStr, pid] of Object.entries(newSlots)) {
      if (!pid) continue;
      const state = nextPlayerStates[pid];
      if (state?.isOnField) {
        nextPlayerStates[pid] = { ...state, slotIndex: parseInt(slotIdxStr) };
      }
    }

    const change: FormationChangeEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      minute,
      half: m.half,
      formationId,
      formationName,
      slotsAfter: { ...newSlots },
    };

    commitModel({
      ...m,
      slots: { ...newSlots },
      playerStates: nextPlayerStates,
      formationChanges: [...m.formationChanges, change],
      currentFormation: { id: formationId, name: formationName },
    });
  }

  const changeFormation = useCallback(
    (formationId: string, formationName: string, newSlots: Record<number, string | null>) => {
      applyFormationChangeLocally(formationId, formationName, newSlots);
      sendIfInPlay("formationChange", { formation: formationId });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ── Substitution window logic (mirrors useMatchSimulation) ────────────────

  const startPrepare = useCallback(() => {
    setPrepareMode(true);
    setPrepareSlotsPreview({ ...modelRef.current.slots });
  }, []);

  const cancelPrepare = useCallback(() => {
    setPrepareMode(false);
    setPrepareSlotsPreview({});
  }, []);

  const movePreparePlayer = useCallback(
    (draggedId: string, fromSlotIndex: number | null, targetSlotIndex: number) => {
      // A sent-off player cannot come back onto the field
      if (getExpelledIds(modelRef.current.cards).has(draggedId)) return;
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

  const movePreparePlayerToBench = useCallback((_draggedId: string, fromSlotIndex: number) => {
    setPrepareSlotsPreview((prev) => {
      const next = { ...prev };
      next[fromSlotIndex] = null;
      return next;
    });
  }, []);

  const commitWindow = useCallback(
    (ratingsByPlayerId: Record<string, number | null>) => {
      const m = modelRef.current;
      const minute = Math.floor(computeCurrentTotalSeconds() / 60);
      const newSlots = prepareSlotsRef.current;

      const { nextPlayerStates, leaving, entering } = applySlotChange(m.slots, newSlots, m.playerStates, minute);

      const swaps: SubstitutionSwap[] = entering.map((inPid, i) => {
        const entry = Object.entries(newSlots).find(([, pid]) => pid === inPid)!;
        const targetSlotIdx = parseInt(entry[0]);
        const outPid = leaving[i] ?? null;
        return { inPlayerId: inPid, outPlayerId: outPid, slotIndex: targetSlotIdx };
      });

      const fillsEmptySlot = !m.isHalftime && entering.length > 0 && leaving.length === 0;
      const windowIndex = m.isHalftime
        ? 0
        : m.windows.filter(countsTowardQuota).length + (fillsEmptySlot ? 0 : 1);

      const newWindow: SubstitutionWindow = {
        windowIndex,
        minute,
        half: m.half,
        swaps,
        slotsAfter: { ...newSlots },
        ...(m.isHalftime ? { isHalftime: true } : {}),
        ...(fillsEmptySlot ? { fillsEmptySlot: true } : {}),
      };

      const snapshot: WindowRatingSnapshot = {
        windowIndex,
        minute,
        ratings: { ...ratingsByPlayerId },
      };

      commitModel({
        ...m,
        slots: { ...newSlots },
        playerStates: nextPlayerStates,
        windows: [...m.windows, newWindow],
        ratingSnapshots: [...m.ratingSnapshots, snapshot],
      });
      setPrepareMode(false);
      setPrepareSlotsPreview({});
      setLastCommittedWindow(newWindow);
      sendIfInPlay("substitution");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commitModel, computeCurrentTotalSeconds],
  );

  const repositionPlayer = useCallback(
    (fromSlotIndex: number, toSlotIndex: number) => {
      if (fromSlotIndex === toSlotIndex) return;
      // Only meaningful outside prepare mode — a real substitution (bench involved)
      // must still go through startPrepare/commitWindow.
      if (prepareModeRef.current) return;

      const m = modelRef.current;
      const fromPlayerId = m.slots[fromSlotIndex] ?? null;
      const toPlayerId = m.slots[toSlotIndex] ?? null;
      if (!fromPlayerId && !toPlayerId) return;

      const nextPlayerStates = { ...m.playerStates };
      if (fromPlayerId && nextPlayerStates[fromPlayerId]) {
        nextPlayerStates[fromPlayerId] = { ...nextPlayerStates[fromPlayerId], slotIndex: toSlotIndex };
      }
      if (toPlayerId && nextPlayerStates[toPlayerId]) {
        nextPlayerStates[toPlayerId] = { ...nextPlayerStates[toPlayerId], slotIndex: fromSlotIndex };
      }
      commitModel({
        ...m,
        slots: { ...m.slots, [fromSlotIndex]: toPlayerId, [toSlotIndex]: fromPlayerId },
        playerStates: nextPlayerStates,
      });
      sendIfInPlay("substitution");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commitModel],
  );

  const replaceWindows = useCallback(
    (correctedWindows: SubstitutionWindow[]) => {
      commitModel({ ...modelRef.current, windows: correctedWindows });
      sendIfInPlay("substitution");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commitModel],
  );

  const dismissConfirmation = useCallback(() => {
    setLastCommittedWindow(null);
  }, []);

  // ── halfDuration setter ───────────────────────────────────────────────────

  const setHalfDuration = useCallback((minutes: number) => {
    setHalfDurationState(minutes);
  }, []);

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
    initialSlots,
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
    setScore,
    cards,
    formationChanges,
    currentFormation,
    pendingMinPlayersCard,
    confirmMinPlayersEnd,
    cancelMinPlayersEnd,
    unlimitedWindows,
    ratingSnapshots,
    pendingAction,
    setPendingAction,
    adjustClock,
    isSaving,
    saveError,
    retrySave,
    hasSavedData,
    savedParticipationData,
    matchDurationMinutes,
    setMatchDuration,
    isDeleting,
    deleteParticipation,
    isOnline: live.isOnline,
    serverStatus: live.status,
    serverVersion: live.state?.version ?? null,
    initMatch,
    confirmAction,
    cancelAction,
    addGoal,
    removeGoal,
    updateGoal,
    addCard,
    removeCard,
    updateCard,
    changeFormation,
    startPrepare,
    cancelPrepare,
    movePreparePlayer,
    movePreparePlayerToBench,
    commitWindow,
    repositionPlayer,
    replaceWindows,
    dismissConfirmation,
    dismissSaveError,
  };
}
