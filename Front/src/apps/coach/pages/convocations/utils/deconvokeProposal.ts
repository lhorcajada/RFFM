import type { SportEventResponse } from "../../../services/sportEventService";
import type { PlayerResponse } from "../../../services/teamplayerService";
import type { PlayerRating } from "../../../types/playerRating";
import type { PositionFit } from "../../../types/positionFit";
import { FIT_POSITION_LABELS, positionForDemarcation } from "../../squad/rating/ratingTraits";
import type { MatchColumn } from "../components/convocationMatchDetail.types";
import type { GridCell } from "../components/convocationMatchDetail.types";
import type { SeasonPlayerStats } from "../components/simulation/liveMatch.types";
import { runRules } from "./rules";
import { DEFAULT_RULES } from "./rules/defaultRules";
import { resolveRule, type DeconvocationRuleConfig } from "./rules/ruleCatalog";
import {
  evaluateRequirements,
  ROLE_MINIMUMS,
  protectionReason,
  roleLabel,
  toPositionPlayer,
  type PositionPlayer,
  type PositionRole,
  type PositionShortfall,
  type RequirementKey,
  type RoleMinimums,
} from "./positionRequirements";
import { isInjuryAbsence } from "./injuryRecovery";
import { DEFAULT_MAX_CALLED_PLAYERS, minimumCalls } from "./minimumCalls";
import type { LastMatchMinutes } from "./lastMatchMinutes";
import {
  attendanceBucket,
  compareFairness,
  CRITERION_NAMES,
  describeCriterion,
  fitShareOf,
  formatCriterionValues,
  formatFitPlace,
  protectionOf,
  type Criterion,
  type FairnessMetrics,
  type FitInfo,
  type Protection,
  type ProtectionKind,
  type ProtectionWindows,
  type RivalDifficulty,
} from "./deconvocationFunnel";
import type { MatchUnavailability } from "./matchUnavailability";

type RivalResult = "win" | "draw" | "loss";

export type ProposalFactor = {
  key: string;
  label: string;
  value: number;
  impact: number;
  /** How the value is displayed; defaults to a plain number. */
  format?: "percent";
};

export type DecisionGroup = "proposed" | "protected" | "notChosen";

export type ProposalDecision = {
  group: DecisionGroup;
  /** The one reason that decided: why the player is out, protected or kept. */
  reason: string;
  /** Deciding criterion of a proposed player; `mandatory` when a rule forces the deconvocation. */
  criterion?: Criterion | "mandatory";
  /** Who the proposed player was preferred over, e.g. "Pedro lleva 4". */
  compare?: string | null;
  /** What keeps a protected player called. */
  protection?: ProtectionKind | "position" | "goalkeeper";
};

export type ProposalComparisonRow = {
  playerId: string;
  name: string;
  position: string;
  /** How the proposed player compares: `decides` he goes before the other, `tie` all criteria match, `position` the other stays for a position minimum. */
  outcome: "decides" | "tie" | "position";
  verdict: string;
};

export type DetailResult = "protects" | "doesNotProtect" | "allows" | "decides" | "tie" | "noEffect" | "mandatory";

export type ProposalDetailRow = { rule: string; value: string; result: DetailResult };

export const DETAIL_RESULT_LABELS: Record<DetailResult, string> = {
  protects: "Protege",
  doesNotProtect: "No protege",
  allows: "Permite",
  decides: "Decide",
  tie: "Empate",
  noEffect: "Sin efecto",
  mandatory: "Obligatorio",
};

export type PlayerProposal = {
  playerId: string;
  displayName: string;
  position: string | null;
  positionRole: PositionRole | null;
  isSelected: boolean;
  forced: boolean;
  /** Never proposed for deconvocation (e.g. a goalkeeper who is neither injured nor sanctioned). */
  locked: boolean;
  score: number;
  factors: ProposalFactor[];
  summary: string;
  calledCount: number;
  startsCount: number;
  startsDataAvailable: boolean;
  minRequiredCalls: number;
  weeklyTraining: WeeklyTrainingStats;
  decision: ProposalDecision;
  /** Every rule evaluated for the player, for the collapsible detail. */
  detail: ProposalDetailRow[];
  /** A proposed player against every eligible player not proposed; empty for the others. */
  comparison: ProposalComparisonRow[];
};

export type AlreadyDeconvokedPlayer = {
  playerId: string;
  displayName: string;
  position: string | null;
  positionRole: PositionRole | null;
};

export type DeconvokeProposal = {
  generatedAt: string;
  /** Difficulty of the rival used as last tiebreak. */
  rivalDifficulty: RivalDifficulty;
  targetCount: number;
  calledCount: number;
  selectedIds: string[];
  previousRivalResult: {
    rival: string;
    result: RivalResult;
    scoreText: string;
    eventDate: string;
    goalDiff: number;
  } | null;
  players: PlayerProposal[];
  /** Position minimums the remaining called players do not meet. */
  positionWarnings: PositionShortfall[];
  /** Squad players already deconvoked, in squad order; never proposed again. */
  alreadyDeconvoked: AlreadyDeconvokedPlayer[];
};

export type BuildProposalInput = {
  players: PlayerResponse[];
  calledIds: string[];
  ratings: Record<string, PlayerRating>;
  streaks: Map<string, number>;
  technicalTotals: Map<string, number>;
  seasonEvents: SportEventResponse[];
  seasonColumns: MatchColumn[];
  enrichedGrid: Map<string, Map<string, GridCell>>;
  seasonStats: SeasonPlayerStats[];
  lastInjuryEndMap: Map<string, string | null>;
  lastInjuryStartMap?: Map<string, string | null>;
  lastInjuryMissedEventsMap?: Map<string, number>;
  currentDate: string | undefined;
  currentEventId: string | null;
  currentRival: string | null;
  weekTrainingStats: Map<string, WeeklyTrainingStats>;
  weekTrainingCount: number;
  maxCalledPlayers?: number;
  /** Starts count per teamPlayerId, computed from match-participation lineups */
  gridStartsCountMap?: Map<string, number>;
  /** Players not available for this match (playerId → reason): always deconvoked. */
  matchUnavailable?: Map<string, MatchUnavailability>;
  /** Players already deconvoked, whatever the reason: out of the squad the proposal works on. */
  alreadyOutIds?: ReadonlySet<string>;
  /** Team's configured deconvocation rules; the default set when omitted. */
  rules?: DeconvocationRuleConfig[];
  /** Difficulty of the rival; medium when unknown. */
  rivalDifficulty?: RivalDifficulty;
  /** Matchdays a technical deconvocation / an injury absence protects; 5 and 1 by default. */
  protectionWindows?: ProtectionWindows;
  /** Minutes of the last played match, to protect those who barely played; absent when unknown. */
  lastMatchMinutes?: LastMatchMinutes | null;
  /** Fit order of each unified position; positions without a usable order keep the fairness order. */
  positionFit?: PositionFit[];
};

/**
 * Place of each called player in the fit order of his active position. Only positions with a confirmed
 * order or at least one calculated fit are used, and only the players called count for the place.
 */
function buildFitInfo(
  positionFit: PositionFit[] | undefined,
  calledIds: string[],
  playerById: Map<string, PlayerResponse>,
): Map<string, FitInfo> {
  const info = new Map<string, FitInfo>();
  const calledSet = new Set(calledIds);
  for (const position of positionFit ?? []) {
    const hasUsableOrder = position.confirmedWeekStart != null || position.candidates.some((c) => c.fit != null);
    if (!hasUsableOrder) continue;
    const called = position.candidates.filter((c) => calledSet.has(c.teamPlayerId));
    called.forEach((candidate, index) => {
      const activePositionId = playerById.get(candidate.teamPlayerId)?.activePositionId;
      if (activePositionId == null || positionForDemarcation(activePositionId) !== position.position) return;
      info.set(candidate.teamPlayerId, {
        share: fitShareOf(index + 1, called.length),
        place: index + 1,
        total: called.length,
        positionLabel: FIT_POSITION_LABELS[position.position],
        value: candidate.fit,
      });
    });
  }
  return info;
}

// "Trainings" include the friendlies the player was called to.
export type WeeklyTrainingStats = {
  totalTrainings: number;
  attendedTrainings: number;
  /** Possible events minus each absence weighted by its excuse (see attendanceWeights). */
  weightedAttendedTrainings: number;
  attendedTrainingsSeason: number;
  weightedAttendedTrainingsSeason: number;
  totalTrainingsSeason: number;
  /** Absences whose excuse can force a deconvocation (see attendanceWeights). */
  knownUnavailableTrainings: number;
};

const NOT_CALLED_NAMES = new Set(["Deconvoke", "No disponible"]);
const POST_INJURY_PREVENTION_EXCUSE_TYPE_ID = 11;

type PlayerInternals = {
  protection: Protection | null;
  forcedLabel: string | null;
  technicalAgo: number | null;
  injuryAgo: number | null;
  lastMinutes: number | null;
  otherAgo: number | null;
  otherReason: string | null;
  technicalMatch: string | null;
  otherMatch: string | null;
  calledCount: number;
  minRequiredCalls: number;
  metrics: FairnessMetrics;
};

function isInjuryOrIllnessAbsence(cell: GridCell | undefined): boolean {
  if (isInjuryAbsence(cell)) return true;
  if (!cell || !NOT_CALLED_NAMES.has(cell.statusName)) return false;
  const excuse = cell.excuseName?.toLowerCase() ?? "";
  return cell.excuseTypeId === 3 || excuse.includes("enfermedad") || excuse.includes("ill");
}

/** Deconvoked for a cause that is neither a technical decision nor an injury or illness (family, studies...). */
function isOtherCauseDeconvocation(cell: GridCell | undefined): boolean {
  if (!cell || !NOT_CALLED_NAMES.has(cell.statusName)) return false;
  return !isTechnicalDecision(cell) && !isInjuryOrIllnessAbsence(cell);
}

type DetailInput = {
  proposal: PlayerProposal;
  internal: PlayerInternals;
  decision: ProposalDecision;
  decidingCriterion: Criterion | null;
  positionReason: string | null;
  windows: ProtectionWindows;
  difficulty: RivalDifficulty;
};

const CRITERIA_ORDER: Criterion[] = ["fit", "consecutive", "surplus", "technicalTotal", "attendance", "rating"];

/** Every rule evaluated for a player, in funnel order, with its value and outcome. */
function buildDetail({ proposal, internal, decision, decidingCriterion, positionReason, windows, difficulty }: DetailInput): ProposalDetailRow[] {
  const { technicalAgo, injuryAgo, lastMinutes, otherAgo, otherReason, calledCount, minRequiredCalls, metrics } = internal;
  const matchdays = (n: number) => (n === 1 ? "1 jornada" : `${n} jornadas`);
  const protectedBy = internal.protection?.kind;
  const rows: ProposalDetailRow[] = [];

  if (proposal.forced) {
    rows.push({ rule: "Regla obligatoria", value: internal.forcedLabel ?? "Disponibilidad", result: "mandatory" });
  }
  rows.push(
    {
      rule: "Desconvocado hace poco",
      value:
        technicalAgo == null
          ? `Sin desconvocatorias técnicas (ventana ${windows.technical})`
          : `Última técnica hace ${matchdays(technicalAgo)} (ventana ${windows.technical})`,
      result: protectedBy === "technicalWindow" ? "protects" : "doesNotProtect",
    },
    {
      rule: "Desconvocado por otro motivo",
      value:
        otherAgo == null
          ? `Sin otras desconvocatorias (ventana ${windows.otherCause})`
          : `${otherReason ?? "Otro motivo"} hace ${matchdays(otherAgo)} (ventana ${windows.otherCause})`,
      result: protectedBy === "otherCause" ? "protects" : "doesNotProtect",
    },
    {
      rule: "Descanso por lesión",
      value:
        injuryAgo == null
          ? `Sin ausencias por lesión (ventana ${windows.injuryRest})`
          : `Ausencia por lesión hace ${matchdays(injuryAgo)} (ventana ${windows.injuryRest})`,
      result: protectedBy === "injuryRest" ? "protects" : "doesNotProtect",
    },
    ...((windows.lowMinutes ?? 0) > 0
      ? [
          {
            rule: "Pocos minutos en el último partido",
            value:
              lastMinutes == null
                ? `Sin datos del último partido (umbral ${windows.lowMinutes} min)`
                : difficulty === "hard"
                  ? `${lastMinutes} min en el último partido: no se aplica ante un rival difícil`
                  : `${lastMinutes} min en el último partido (umbral ${windows.lowMinutes} min)`,
            result: (protectedBy === "lowMinutes" ? "protects" : "doesNotProtect") as ProposalDetailRow["result"],
          },
        ]
      : []),
    {
      rule: "Mínimo de convocatorias",
      value: `${calledCount} de ${minRequiredCalls} exigidas`,
      result: protectedBy === "minCalls" ? "protects" : "doesNotProtect",
    },
  );
  if (positionReason) {
    rows.push({ rule: "Mínimo por posición", value: positionReason.replace("Protegido: ", ""), result: "protects" });
  } else if (decision.group === "proposed" && !proposal.forced) {
    rows.push({ rule: "Mínimo por posición", value: "Se mantiene el mínimo de su posición", result: "allows" });
  }

  if (!proposal.forced && !internal.protection && !positionReason && !proposal.locked) {
    const values: Record<Criterion, [string, string]> = {
      fit: [
        "Encaje en el puesto",
        metrics.fit ? formatFitPlace(metrics.fit) : "Sin orden de encaje para su puesto",
      ],
      consecutive: ["Jornadas seguidas convocado", String(metrics.consecutive)],
      surplus: ["Convocatorias sobre el mínimo", String(metrics.surplus)],
      technicalTotal: ["Desconvocatorias técnicas", String(metrics.technicalTotal)],
      attendance: ["Asistencia a entrenamientos", `${metrics.attendanceBucket * 10}%`],
      rating: ["Nivel ante rival difícil", metrics.rating.toFixed(1).replace(".", ",")],
    };
    const decidingIndex = decidingCriterion ? CRITERIA_ORDER.indexOf(decidingCriterion) : -1;
    CRITERIA_ORDER.forEach((criterion, index) => {
      if (criterion === "rating" && difficulty !== "hard") return;
      let result: DetailResult = "noEffect";
      if (criterion === "fit" && !metrics.fit) {
        rows.push({ rule: values[criterion][0], value: values[criterion][1], result });
        return;
      }
      if (decision.group === "proposed") {
        if (criterion === decidingCriterion) result = "decides";
        else if (decidingIndex === -1 || index < decidingIndex) result = "tie";
      }
      rows.push({ rule: values[criterion][0], value: values[criterion][1], result });
    });
  }
  return rows;
}

// ── Position-aware selection ─────────────────────────────────────────────────

export type DeconvocationCandidate = { playerId: string; forced: boolean; locked?: boolean };

export type DeconvocationSelection = {
  selectedIds: string[];
  /** Candidates kept called because removing them would break a position minimum. */
  protectedBy: Map<string, RequirementKey>;
  /** Players still available for the requirement that protects each candidate. */
  protectedRemaining: Map<string, number>;
  shortfalls: PositionShortfall[];
};

function firstWorsenedRequirement(
  before: PositionShortfall[],
  after: PositionShortfall[],
): RequirementKey | null {
  const gapBefore = new Map(before.map((s) => [s.requirement, s.required - s.remaining]));
  const worsened = after.find((s) => s.required - s.remaining > (gapBefore.get(s.requirement) ?? 0));
  return worsened?.requirement ?? null;
}

/**
 * Picks who to deconvoke from candidates ordered most-deconvokable first. Mandatory
 * candidates always go; the rest are skipped when they would break a position minimum,
 * unless no other choice reaches the target.
 */
export function selectDeconvocations(
  ordered: DeconvocationCandidate[],
  positionPlayers: Map<string, PositionPlayer>,
  targetCount: number,
  minimums: RoleMinimums = ROLE_MINIMUMS,
): DeconvocationSelection {
  const selected = new Set(ordered.filter((c) => c.forced && !c.locked).map((c) => c.playerId));
  const protectedBy = new Map<string, RequirementKey>();
  const protectedRemaining = new Map<string, number>();
  const positionOf = (id: string): PositionPlayer =>
    positionPlayers.get(id) ?? { id, role: null, possibleRoles: [] };
  const evaluateWithout = (excludedId?: string) =>
    evaluateRequirements(
      ordered
        .filter((c) => !selected.has(c.playerId) && c.playerId !== excludedId)
        .map((c) => positionOf(c.playerId)),
      minimums,
    );

  for (const candidate of ordered) {
    if (selected.size >= targetCount) break;
    if (selected.has(candidate.playerId) || candidate.locked) continue;
    const before = evaluateWithout();
    const after = evaluateWithout(candidate.playerId);
    // Players able to play a position through a possible demarcation compensate any deconvocation.
    const breaksMinimum = after.deficit > before.deficit;
    if (breaksMinimum) {
      const requirement = firstWorsenedRequirement(before.shortfalls, after.shortfalls);
      if (requirement) {
        protectedBy.set(candidate.playerId, requirement);
        protectedRemaining.set(candidate.playerId, before.available.get(requirement) ?? 0);
      }
      continue;
    }
    selected.add(candidate.playerId);
  }

  while (selected.size < targetCount) {
    const base = evaluateWithout();
    let best: DeconvocationCandidate | null = null;
    let bestIncrease = Infinity;
    for (const candidate of ordered) {
      if (selected.has(candidate.playerId) || candidate.locked) continue;
      const after = evaluateWithout(candidate.playerId);
      const increase = after.deficit - base.deficit;
      if (increase < bestIncrease) {
        best = candidate;
        bestIncrease = increase;
      }
    }
    if (!best) break;
    selected.add(best.playerId);
    protectedBy.delete(best.playerId);
    protectedRemaining.delete(best.playerId);
  }

  return {
    selectedIds: ordered.filter((c) => selected.has(c.playerId)).map((c) => c.playerId),
    protectedBy,
    protectedRemaining,
    shortfalls: evaluateWithout().shortfalls,
  };
}

function normalizeName(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function playerDisplayName(p: PlayerResponse): string {
  return p.alias || `${p.name ?? ""} ${p.lastName ?? ""}`.trim() || "Jugador";
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function parseNum(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function toIsoDay(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function diffDays(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00`).getTime();
  const to = new Date(`${toIso}T00:00:00`).getTime();
  return Math.floor((to - from) / (1000 * 60 * 60 * 24));
}

function isTechnicalDecision(cell: GridCell | undefined): boolean {
  if (!cell) return false;
  if (!NOT_CALLED_NAMES.has(cell.statusName)) return false;
  if (cell.statusName === "No disponible") return false;
  if (!cell.excuseTypeId) return true;
  return !!cell.excuseName?.toLowerCase().includes("decisi");
}

export function isProtectedStreakAbsence(cell: GridCell | undefined): boolean {
  if (!cell) return false;
  if (!NOT_CALLED_NAMES.has(cell.statusName)) return false;
  if (cell.statusName === "No disponible") return true;

  const excuseName = cell.excuseName?.toLowerCase() ?? "";
  return (
    cell.excuseTypeId === 1 ||
    cell.excuseTypeId === 3 ||
    cell.excuseTypeId === 4 ||
    excuseName.includes("lesi") ||
    excuseName.includes("enfermedad") ||
    excuseName.includes("ill") ||
    excuseName.includes("problema familiar") ||
    excuseName.includes("family problem")
  );
}

function isNonTechnicalAbsence(cell: GridCell | undefined): boolean {
  if (!cell) return false;
  if (!NOT_CALLED_NAMES.has(cell.statusName)) return false;
  return !isTechnicalDecision(cell);
}

function findPreviousRivalResult(
  seasonEvents: SportEventResponse[],
  currentDate: string | undefined,
  currentEventId: string | null,
  currentRival: string | null,
): DeconvokeProposal["previousRivalResult"] {
  const currentIso = toIsoDay(currentDate);
  if (!currentIso || !currentRival) return null;
  const rivalNorm = normalizeName(currentRival);
  if (!rivalNorm) return null;

  const candidates = seasonEvents
    .filter((ev) => {
      if (currentEventId && ev.id === currentEventId) return false;
      const evDay = toIsoDay(ev.start ?? ev.eveDateTime ?? ev.startTime ?? null);
      if (!evDay || evDay >= currentIso) return false;
      const rival = normalizeName(ev.rivalName ?? ev.rival ?? null);
      return rival === rivalNorm;
    })
    .sort((a, b) => {
      const ad = toIsoDay(a.start ?? a.eveDateTime ?? a.startTime ?? null) ?? "";
      const bd = toIsoDay(b.start ?? b.eveDateTime ?? b.startTime ?? null) ?? "";
      return bd.localeCompare(ad);
    });

  for (const ev of candidates) {
    const localGoals = parseNum(ev.localGoals);
    const visitorGoals = parseNum(ev.visitorGoals);
    if (localGoals == null || visitorGoals == null) continue;
    const isHome = ev.isHomeMatch !== false;
    const ownGoals = isHome ? localGoals : visitorGoals;
    const rivalGoals = isHome ? visitorGoals : localGoals;
    const result: RivalResult = ownGoals > rivalGoals ? "win" : ownGoals < rivalGoals ? "loss" : "draw";
    return {
      rival: currentRival,
      result,
      scoreText: `${ownGoals}-${rivalGoals}`,
      eventDate: toIsoDay(ev.start ?? ev.eveDateTime ?? ev.startTime ?? null) ?? "",
      goalDiff: Math.abs(ownGoals - rivalGoals),
    };
  }
  return null;
}

export function buildDeconvokeProposal(input: BuildProposalInput): DeconvokeProposal {
  const {
    players,
    calledIds: squadIds,
    ratings,
    streaks,
    technicalTotals,
    seasonEvents,
    seasonColumns: allSeasonColumns,
    enrichedGrid,
    seasonStats,
    lastInjuryEndMap,
    lastInjuryStartMap,
    lastInjuryMissedEventsMap,
    currentDate,
    currentEventId,
    currentRival,
    weekTrainingStats,
    weekTrainingCount,
    maxCalledPlayers = DEFAULT_MAX_CALLED_PLAYERS,
    gridStartsCountMap,
    matchUnavailable,
    alreadyOutIds,
    rules = DEFAULT_RULES,
    rivalDifficulty = "medium",
  } = input;
  // Rules the team never saved keep the base behaviour (fair share at 100 %, the standard position minimums).
  const minCallsPercent = resolveRule("minCalls", rules)?.points.percent ?? 100;
  const roleMinimums: RoleMinimums = { ...ROLE_MINIMUMS, ...resolveRule("positionMinimums", rules)?.points };
  const protectionWindows: ProtectionWindows = input.protectionWindows ?? {
    technical: resolveRule("recentDeconvocation", rules)?.points.window ?? 0,
    injuryRest: resolveRule("injuryRest", rules)?.points.window ?? 0,
    otherCause: resolveRule("otherDeconvocation", rules)?.points.window ?? 0,
    lowMinutes: resolveRule("lowMinutes", rules)?.points.minutes ?? 0,
  };

  // Only league matches count as matchdays: friendlies and tournaments are left out of every count.
  const seasonColumns = allSeasonColumns.filter((col) => col.isLeague !== false);

  const calledIds = alreadyOutIds ? squadIds.filter((id) => !alreadyOutIds.has(id)) : squadIds;

  const previousRivalResult = findPreviousRivalResult(
    seasonEvents,
    currentDate,
    currentEventId,
    currentRival,
  );

  const playerById = new Map(players.map((p) => [p.id, p]));
  // Listed from the full squad, before the filter above; display only, never fed to scoring.
  const alreadyDeconvoked: AlreadyDeconvokedPlayer[] = alreadyOutIds
    ? squadIds.flatMap((id) => {
        const p = playerById.get(id);
        if (!p || !alreadyOutIds.has(id)) return [];
        return [
          {
            playerId: id,
            displayName: playerDisplayName(p),
            position: p.position ?? null,
            positionRole: toPositionPlayer(p).role,
          },
        ];
      })
    : [];
  const seasonStatsMap = new Map(seasonStats.map((s) => [s.teamPlayerId, s]));

  // calledCount = times convoked this season, computed from the grid (statusId 1/2 = called).
  // This is more reliable than seasonStats.totalMatches which only counts played matches.
  const CALLED_STATUS_IDS_SET = new Set([1, 2]);
  const gridCalledCountMap = new Map<string, number>();
  for (const col of seasonColumns) {
    const colMap = enrichedGrid.get(col.eventId);
    if (!colMap) continue;
    colMap.forEach((cell, pid) => {
      if (cell.statusId != null && CALLED_STATUS_IDS_SET.has(cell.statusId)) {
        gridCalledCountMap.set(pid, (gridCalledCountMap.get(pid) ?? 0) + 1);
      }
    });
  }
  const maxCalled = Math.max(1, ...Array.from(gridCalledCountMap.values()));
  const allStarts = gridStartsCountMap && gridStartsCountMap.size > 0
    ? Array.from(gridStartsCountMap.values())
    : seasonStats.map((s) => s.totalStarts);
  const maxStarts = Math.max(0, ...allStarts);
  // If no player has any starts recorded, the live-match system isn't being used.
  const startsDataAvailable = maxStarts > 0;
  const currentIso = toIsoDay(currentDate);

  const positionPlayers = new Map<string, PositionPlayer>();
  for (const pid of calledIds) {
    const p = playerById.get(pid);
    if (p) positionPlayers.set(pid, toPositionPlayer(p));
  }
  const maxTechnicalTotal = Math.max(
    0,
    ...calledIds.map((pid) => technicalTotals.get(pid) ?? 0),
  );
  const fitInfoById = buildFitInfo(input.positionFit, calledIds, playerById);

  const internals = new Map<string, PlayerInternals>();
  const proposals = calledIds
    .map((playerId) => {
      const p = playerById.get(playerId);
      if (!p) return null;

      const displayName = playerDisplayName(p);
      const r = ratings[playerId];
      const competitiveness = r?.competitiveness ?? 5;
      const physical = r?.physical ?? 5;
      const tactical = r?.tactical ?? 5;
      const technical = r?.technical ?? 5;
      const ratingWeights = resolveRule("rating", rules)?.weights ?? resolveRule("rating", DEFAULT_RULES)!.weights;
      const weightedRating =
        competitiveness * ratingWeights.competitiveness +
        physical * ratingWeights.physical +
        tactical * ratingWeights.tactical +
        technical * ratingWeights.technical;

      const calledStats = seasonStatsMap.get(playerId);
      const calledCount = gridCalledCountMap.get(playerId) ?? 0;
      const startsCount = gridStartsCountMap?.get(playerId) ?? calledStats?.totalStarts ?? 0;

      const technicalStreak = streaks.get(playerId) ?? 0;
      const technicalTotal = technicalTotals.get(playerId) ?? 0;

      // Count injury absences (for technical-streak discounting) and all non-technical absences
      // (for availability-based denominators).
      // seasonColumns is ordered newest-first (same order as matchColumns from the grid hook).
      // The streak covers the first `technicalStreak` entries (most recent rounds).
      // Rounds where the player was injured shouldn't inflate the technical streak.
      let injuryAbsences = 0;
      let nonTechnicalAbsences = 0;
      let protectedAbsencesInStreak = 0;
      seasonColumns.forEach((col, i) => {
        const cell = enrichedGrid.get(col.eventId)?.get(playerId);
        if (isNonTechnicalAbsence(cell)) {
          nonTechnicalAbsences++;
        }
        if (isInjuryAbsence(cell)) {
          injuryAbsences++;
        }
        if (isProtectedStreakAbsence(cell) && i < technicalStreak) {
          protectedAbsencesInStreak++;
        }
      });

      // For team-necessity, absences by injury/personal reasons must not penalize the player.
      // Use the player's available matches as denominator for call/start rates.
      const seasonMatchCount = seasonColumns.length + 1;
      const availableMatches = Math.max(0, seasonMatchCount - nonTechnicalAbsences);
      const competitivenessRate = clamp01(competitiveness / 10);
      // Necesidad para el equipo: usar únicamente la competitividad.
      // Prioriza el nivel competitivo por encima de titularidades/convocatorias.
      const necessity = competitivenessRate;

      // Effective streak: discount rounds where the player was unavailable due to a
      // protected cause (injury, illness, or family problem), because those do not
      // represent a coach-driven technical deconvocation.
      const effectiveStreak = Math.max(0, technicalStreak - protectedAbsencesInStreak);

      // Fair share of the matches already played the player was available for, given how many of the
      // squad are called each matchday.
      const playedAvailable = Math.max(0, availableMatches - 1);
      const minRequiredCalls = minimumCalls({
        playedAvailable,
        maxCalledPlayers,
        squadSize: squadIds.length,
        percent: minCallsPercent,
      });

      let technicalAgo: number | null = null;
      let injuryAgo: number | null = null;
      let otherAgo: number | null = null;
      let otherReason: string | null = null;
      let technicalMatch: string | null = null;
      let otherMatch: string | null = null;
      let injuryPrevention = false;
      let injuryMatch: string | null = null;
      const lastMinutes = input.lastMatchMinutes?.minutes.get(playerId) ?? null;
      // Against a hard rival the best players are needed: few minutes do not shield anyone.
      const protectingMinutes = rivalDifficulty === "hard" ? null : lastMinutes;
      let consecutive = 0;
      let streakOpen = true;
      seasonColumns.forEach((col, i) => {
        const cell = enrichedGrid.get(col.eventId)?.get(playerId);
        if (technicalAgo === null && isTechnicalDecision(cell)) {
          technicalAgo = i + 1;
          technicalMatch = col.label;
        }
        if (injuryAgo === null && isInjuryOrIllnessAbsence(cell)) {
          injuryAgo = i + 1;
          injuryMatch = col.label;
          injuryPrevention = cell?.excuseTypeId === POST_INJURY_PREVENTION_EXCUSE_TYPE_ID;
        }
        if (otherAgo === null && isOtherCauseDeconvocation(cell)) {
          otherAgo = i + 1;
          otherReason = cell?.excuseName ?? null;
          otherMatch = col.label;
        }
        if (streakOpen && cell?.statusId != null && CALLED_STATUS_IDS_SET.has(cell.statusId)) consecutive++;
        else streakOpen = false;
      });

      // Prepare week stats early so they can be used in the combined score
      

      const factors: ProposalFactor[] = [];
      let score = 0;
      let forced = false;
      let forcedLabel: string | null = null;

      // Execute modular rules (streak, technical-total, combined, minimum,
      // position coverage, rival result, injured, weekly training, recent recovery)
      // Build a compact per-player context and delegate calculations to the
      // rule runner. Each rule returns factors and a delta (and an optional
      // forced flag). This keeps the main flow concise and makes rules
      // independently testable.
      const weekStats =
        weekTrainingStats.get(playerId) ??
        {
          totalTrainings: weekTrainingCount,
          attendedTrainings: 0,
          weightedAttendedTrainings: 0,
          attendedTrainingsSeason: 0,
          weightedAttendedTrainingsSeason: 0,
          totalTrainingsSeason: 0,
          knownUnavailableTrainings: 0,
        };

      const ruleCtx = {
        input,
        playerId,
        player: p,
        displayName,
        weightedRating,
        competitiveness,
        physical,
        tactical,
        technical,
        necessity,
        weekStats,
        seasonPlayerStats: calledStats ?? null,
        effectiveStreak,
        technicalTotal,
        injuryAbsencesInStreak: protectedAbsencesInStreak,
        calledCount,
        startsCount,
        startsDataAvailable,
        minRequiredCalls,
        calledIds,
        playerById,
        ratings,
        previousRivalResult,
        seasonColumns,
        enrichedGrid,
        lastInjuryEndMap,
        lastInjuryStartMap,
        lastInjuryMissedEventsMap,
        currentIso,
        weekTrainingCount,
        maxTechnicalTotal,
      } as const;

      const ruleResults = runRules(ruleCtx as any, rules);
      for (const rr of ruleResults) {
        if (rr.forced) {
          forced = true;
          forcedLabel ??= rr.factors[0]?.label ?? null;
        }
        score += rr.delta;
        for (const f of rr.factors) factors.push(f);
      }

      const unavailability = matchUnavailable?.get(playerId);
      const isGoalkeeper = positionPlayers.get(playerId)?.role === "goalkeeper";
      const goalkeeperMayMiss = p.isInjured === true || unavailability !== undefined;
      const locked = isGoalkeeper && !goalkeeperMayMiss;

      if (locked) {
        forced = false;
        factors.push({
          key: "goalkeeperAlwaysCalled",
          label: "Portero: siempre convocado salvo lesión, sanción o no disponibilidad",
          value: 1,
          impact: 0,
        });
      } else if (unavailability && !forced) {
        forced = true;
        score -= 120;
        factors.push({
          key: "matchUnavailable",
          label: `No disponible para el partido: ${unavailability.reason}`,
          value: 1,
          impact: -120,
        });
      }

      const summary = forced
        ? "Regla obligatoria de disponibilidad física aplicada"
        : "Ordenado por el embudo de desconvocatoria";

      const protection = forced || isGoalkeeper
        ? null
        : protectionOf({ technicalAgo, injuryAgo, injuryPrevention, injuryMatch, lastMinutes: protectingMinutes, lastMinutesMatch: input.lastMatchMinutes?.label, otherAgo, otherReason, technicalMatch, otherMatch, calledCount, minRequiredCalls }, protectionWindows);
      internals.set(playerId, {
        protection,
        forcedLabel: forcedLabel ?? unavailability?.reason ?? null,
        technicalAgo,
        injuryAgo,
        lastMinutes,
        otherAgo,
        otherReason,
        technicalMatch,
        otherMatch,
        calledCount,
        minRequiredCalls,
        metrics: {
          consecutive,
          surplus: calledCount - minRequiredCalls,
          technicalTotal,
          attendanceBucket: attendanceBucket(
            weekStats.totalTrainingsSeason > 0
              ? weekStats.weightedAttendedTrainingsSeason / weekStats.totalTrainingsSeason
              : null,
          ),
          rating: weightedRating,
          fit: fitInfoById.get(playerId),
        },
      });

      return {
        playerId,
        displayName,
        position: p.position ?? null,
        positionRole: positionPlayers.get(playerId)?.role ?? null,
        isSelected: false as boolean,
        forced,
        locked,
        score: Number(score.toFixed(2)),
        factors,
        summary,
        calledCount,
        startsCount,
        startsDataAvailable,
        minRequiredCalls,
        weeklyTraining: weekStats,
        decision: { group: "notChosen", reason: "" },
        detail: [],
        comparison: [],
      } as PlayerProposal;
    })
    .filter((item): item is PlayerProposal => item !== null);

  const metricsOf = (id: string): FairnessMetrics => internals.get(id)!.metrics;
  const isHeldByProtection = (p: PlayerProposal) => !p.forced && internals.get(p.playerId)?.protection != null;
  const byFairness = (a: PlayerProposal, b: PlayerProposal) =>
    compareFairness(metricsOf(a.playerId), metricsOf(b.playerId), rivalDifficulty).order;
  const forcedPlayers = proposals.filter((p) => p.forced);
  const eligible = proposals
    .filter((p) => !p.forced && !p.locked && !isHeldByProtection(p))
    .sort(byFairness);
  const held = proposals.filter((p) => !p.forced && (p.locked || isHeldByProtection(p)));
  const orderedProposals = [...forcedPlayers, ...eligible, ...held];

  const forcedCount = forcedPlayers.length;
  const targetCount = Math.max(forcedCount, calledIds.length - maxCalledPlayers, 0);

  const { selectedIds, protectedBy, protectedRemaining, shortfalls } = selectDeconvocations(
    orderedProposals.map((p) => ({
      playerId: p.playerId,
      forced: p.forced,
      locked: p.locked || isHeldByProtection(p),
    })),
    positionPlayers,
    targetCount,
    roleMinimums,
  );
  const selectedSet = new Set(selectedIds);

  // Eligible players the loop did not reach (the target was met first) stay called when they could not
  // take the place of a proposed player without breaking a position minimum; they are reported as
  // protected by position, not as not chosen.
  const remainingPositions = orderedProposals.filter((p) => !selectedSet.has(p.playerId));
  const toPositions = (list: PlayerProposal[]) =>
    list.map((p) => positionPlayers.get(p.playerId) ?? { id: p.playerId, role: null, possibleRoles: [] });
  const baseEvaluation = evaluateRequirements(toPositions(remainingPositions), roleMinimums);
  /** Requirement that breaks when `other` is deconvoked instead of the proposed `chosen` (or in addition, without one). */
  const positionBlock = (other: PlayerProposal, chosen?: PlayerProposal): RequirementKey | null => {
    const kept = remainingPositions.filter((p) => p !== other);
    const after = evaluateRequirements(toPositions(chosen ? [...kept, chosen] : kept), roleMinimums);
    if (after.deficit <= baseEvaluation.deficit) return null;
    return firstWorsenedRequirement(baseEvaluation.shortfalls, after.shortfalls);
  };
  const replaceable = eligible.filter((p) => selectedSet.has(p.playerId));
  for (const candidate of eligible) {
    if (selectedSet.has(candidate.playerId) || protectedBy.has(candidate.playerId)) continue;
    const blocks = replaceable.length > 0 ? replaceable.map((chosen) => positionBlock(candidate, chosen)) : [positionBlock(candidate)];
    if (blocks.some((b) => b === null) || blocks.length === 0) continue;
    const requirement = blocks[0]!;
    protectedBy.set(candidate.playerId, requirement);
    protectedRemaining.set(candidate.playerId, baseEvaluation.available.get(requirement) ?? 0);
  }

  const selectedEligible = eligible.filter((p) => selectedSet.has(p.playerId));
  const sameRole = (a: PlayerProposal, b: PlayerProposal) => a.positionRole === b.positionRole;

  const playersWithSelection = orderedProposals.map((p) => {
    const internal = internals.get(p.playerId)!;
    const requirement = protectedBy.get(p.playerId);
    const remaining = protectedRemaining.get(p.playerId) ?? 0;
    const positionReason = requirement ? protectionReason(requirement, remaining, roleMinimums) : null;
    const factors = requirement
      ? [...p.factors, { key: "positionProtection", label: positionReason!, value: remaining, impact: 0 }]
      : p.factors;
    const isSelected = selectedSet.has(p.playerId);

    let decision: ProposalDecision;
    let decidingCriterion: Criterion | null = null;
    let comparison: ProposalComparisonRow[] = [];
    if (isSelected && p.forced) {
      decision = {
        group: "proposed",
        criterion: "mandatory",
        reason: `Obligatorio: ${internal.forcedLabel ?? "regla de disponibilidad"}`,
      };
    } else if (isSelected) {
      const own = metricsOf(p.playerId);
      const others = eligible.filter((o) => o !== p && !selectedSet.has(o.playerId));
      comparison = others.map((o) => {
        if (protectedBy.has(o.playerId)) {
          return {
            playerId: o.playerId,
            name: o.displayName,
            position: roleLabel(o.positionRole ?? null),
            outcome: "position" as const,
            verdict: "Se queda por el mínimo de su posición",
          };
        }
        const { criterion } = compareFairness(own, metricsOf(o.playerId), rivalDifficulty);
        return {
          playerId: o.playerId,
          name: o.displayName,
          position: roleLabel(o.positionRole ?? null),
          outcome: criterion ? ("decides" as const) : ("tie" as const),
          verdict: criterion
            ? `Decide: ${CRITERION_NAMES[criterion]} (${formatCriterionValues(criterion, own, metricsOf(o.playerId))})`
            : "Empate en todos los criterios",
        };
      });
      const contenders = others.filter((o) => !protectedBy.has(o.playerId));
      const ties = contenders.filter((o) => compareFairness(own, metricsOf(o.playerId), rivalDifficulty).criterion === null);
      const peer = contenders[0];
      const field = `Frente a los otros ${others.length} elegibles`;
      if (!peer) {
        decision = {
          group: "proposed",
          reason: "Elegido: necesario para llegar al objetivo respetando los mínimos por posición",
        };
      } else if (ties.length > 0) {
        decision = {
          group: "proposed",
          reason: `Elegido: empata con ${ties.map((o) => o.displayName).join(", ")} en todos los criterios, incluido el nivel, y va antes en la plantilla`,
          compare: `${field}: ${ties.length} empatan con él`,
        };
      } else {
        const { criterion } = compareFairness(own, metricsOf(peer.playerId), rivalDifficulty);
        decidingCriterion = criterion;
        const text = describeCriterion(
          criterion!,
          own,
          metricsOf(peer.playerId),
          peer.displayName,
          p.displayName,
          rivalDifficulty,
        );
        decision = {
          group: "proposed",
          criterion: criterion!,
          reason: `Elegido: ${text.chosen}`,
          compare: `${field}. El más parecido: ${text.compare}`,
        };
      }
    } else if (p.locked && !internal.protection) {
      decision = {
        group: "protected",
        protection: "goalkeeper",
        reason: "Portero: siempre convocado salvo lesión, sanción o no disponibilidad",
      };
    } else if (internal.protection) {
      decision = { group: "protected", protection: internal.protection.kind, reason: internal.protection.reason };
    } else if (positionReason) {
      decision = { group: "protected", protection: "position", reason: positionReason };
    } else {
      const index = eligible.indexOf(p);
      const earlier = selectedEligible.filter((o) => eligible.indexOf(o) < index);
      const preferred = earlier.find((o) => sameRole(o, p)) ?? earlier[earlier.length - 1];
      if (!preferred) {
        decision = { group: "notChosen", reason: "No ha hecho falta desconvocar a más jugadores" };
      } else {
        const { criterion } = compareFairness(metricsOf(preferred.playerId), metricsOf(p.playerId), rivalDifficulty);
        decision = {
          group: "notChosen",
          reason: criterion
            ? describeCriterion(
                criterion,
                metricsOf(preferred.playerId),
                metricsOf(p.playerId),
                p.displayName,
                preferred.displayName,
                rivalDifficulty,
              ).notChosen
            : `Empata con ${preferred.displayName} en todos los criterios y va después en la plantilla`,
        };
      }
    }

    return {
      ...p,
      factors,
      isSelected,
      decision,
      comparison,
      detail: buildDetail({
        proposal: p,
        internal,
        decision,
        decidingCriterion,
        positionReason,
        windows: protectionWindows,
        difficulty: rivalDifficulty,
      }),
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    rivalDifficulty,
    targetCount,
    calledCount: calledIds.length,
    selectedIds,
    previousRivalResult,
    players: playersWithSelection,
    positionWarnings: shortfalls,
    alreadyDeconvoked,
  };
}

// Helper to format factor values for display in the UI
export function formatProposalFactorValue(factor: ProposalFactor): string {
  const n = Number(factor.value ?? 0);
  const nf0 = (v: number) => new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(v);
  const nf1 = (v: number) => new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(v);
  const nf2 = (v: number) => new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(v);
  const label = (factor.label ?? "").toLowerCase();
  switch (factor.key) {
    case "necessity":
      return `Nivel ${nf1(n)}`;
    case "rivalResult":
      return `${nf0(n)}%`;
    case "rating":
      return nf2(n);
    case "streak":
      return `${Math.round(n)} jornadas`;
    case "technicalTotal":
    case "minimum":
    case "positionProtection":
      return nf0(n);
    case "weeklyTraining":
      if (factor.format === "percent" || label.includes("puntos por asistencia")) return `${nf0(n)}%`;
      return `${nf0(n)} entrenos`;
    case "weeklyTrainingAccum":
      return `${nf0(n)}%`;
    case "recentRecovery":
    case "recoveryProtection":
      return `${nf0(n)} días`;
    case "recentDeconvocation":
      return n === 1 ? "hace 1 jornada" : `hace ${nf0(n)} jornadas`;
    default:
      return Number.isInteger(n) ? new Intl.NumberFormat("es-ES").format(n) : nf2(n);
  }
}
