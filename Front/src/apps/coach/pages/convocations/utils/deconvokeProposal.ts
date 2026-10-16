import type { SportEventResponse } from "../../../services/sportEventService";
import type { PlayerResponse } from "../../../services/teamplayerService";
import type { PlayerRating } from "../../../types/playerRating";
import type { MatchColumn } from "../components/convocationMatchDetail.types";
import type { GridCell } from "../components/convocationMatchDetail.types";
import type { SeasonPlayerStats } from "../components/simulation/liveMatch.types";
import { runRules } from "./rules";
import {
  evaluateRequirements,
  protectionReason,
  requiredCount,
  toPositionPlayer,
  type PositionPlayer,
  type PositionRole,
  type PositionShortfall,
  type RequirementKey,
} from "./positionRequirements";
import { INJURY_EXCUSE_ID, SANCTION_EXCUSE_ID, type MatchUnavailability } from "./matchUnavailability";

type RivalResult = "win" | "draw" | "loss";

export type ProposalFactor = {
  key: string;
  label: string;
  value: number;
  impact: number;
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
};

export type DeconvokeProposal = {
  generatedAt: string;
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
};

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

// ── Position-aware selection ─────────────────────────────────────────────────

export type DeconvocationCandidate = { playerId: string; forced: boolean; locked?: boolean };

export type DeconvocationSelection = {
  selectedIds: string[];
  /** Candidates kept called because removing them would break a position minimum. */
  protectedBy: Map<string, RequirementKey>;
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
): DeconvocationSelection {
  const selected = new Set(ordered.filter((c) => c.forced && !c.locked).map((c) => c.playerId));
  const protectedBy = new Map<string, RequirementKey>();
  const positionOf = (id: string): PositionPlayer =>
    positionPlayers.get(id) ?? { id, role: null, possibleRoles: [] };
  const evaluateWithout = (excludedId?: string) =>
    evaluateRequirements(
      ordered
        .filter((c) => !selected.has(c.playerId) && c.playerId !== excludedId)
        .map((c) => positionOf(c.playerId)),
    );

  for (const candidate of ordered) {
    if (selected.size >= targetCount) break;
    if (selected.has(candidate.playerId) || candidate.locked) continue;
    const before = evaluateWithout();
    const after = evaluateWithout(candidate.playerId);
    // Cover from possible demarcations only fills gaps left by mandatory deconvocations or a
    // short squad; it never justifies leaving out an available specialist.
    const breaksMinimum = after.deficit > before.deficit;
    const leavesSpecialistGap = after.specialistDeficit > before.specialistDeficit;
    if (breaksMinimum || leavesSpecialistGap) {
      const requirement =
        firstWorsenedRequirement(before.shortfalls, after.shortfalls) ??
        firstWorsenedRequirement(before.specialistShortfalls, after.specialistShortfalls);
      if (requirement) protectedBy.set(candidate.playerId, requirement);
      continue;
    }
    selected.add(candidate.playerId);
  }

  while (selected.size < targetCount) {
    const base = evaluateWithout();
    let best: DeconvocationCandidate | null = null;
    let bestIncrease = [Infinity, Infinity];
    for (const candidate of ordered) {
      if (selected.has(candidate.playerId) || candidate.locked) continue;
      const after = evaluateWithout(candidate.playerId);
      const increase = [after.deficit - base.deficit, after.specialistDeficit - base.specialistDeficit];
      const isBetter =
        increase[0] < bestIncrease[0] || (increase[0] === bestIncrease[0] && increase[1] < bestIncrease[1]);
      if (isBetter) {
        best = candidate;
        bestIncrease = increase;
      }
    }
    if (!best) break;
    selected.add(best.playerId);
    protectedBy.delete(best.playerId);
  }

  return {
    selectedIds: ordered.filter((c) => selected.has(c.playerId)).map((c) => c.playerId),
    protectedBy,
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

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function parseNum(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toIsoDay(value: string | null | undefined): string | null {
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

function isInjuryAbsence(cell: GridCell | undefined): boolean {
  if (!cell) return false;
  if (!NOT_CALLED_NAMES.has(cell.statusName)) return false;
  if (cell.statusName === "No disponible") return true;
  return cell.excuseTypeId === 1 || !!cell.excuseName?.toLowerCase().includes("lesi");
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
    calledIds,
    ratings,
    streaks,
    technicalTotals,
    seasonEvents,
    seasonColumns,
    enrichedGrid,
    seasonStats,
    lastInjuryEndMap,
    lastInjuryMissedEventsMap,
    currentDate,
    currentEventId,
    currentRival,
    weekTrainingStats,
    weekTrainingCount,
    maxCalledPlayers = 18,
    gridStartsCountMap,
    matchUnavailable,
  } = input;

  const previousRivalResult = findPreviousRivalResult(
    seasonEvents,
    currentDate,
    currentEventId,
    currentRival,
  );

  const playerById = new Map(players.map((p) => [p.id, p]));
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

  const proposals = calledIds
    .map((playerId) => {
      const p = playerById.get(playerId);
      if (!p) return null;

      const displayName =
        p.alias || `${p.name ?? ""} ${p.lastName ?? ""}`.trim() || "Jugador";
      const r = ratings[playerId];
      const competitiveness = r?.competitiveness ?? 5;
      const physical = r?.physical ?? 5;
      const tactical = r?.tactical ?? 5;
      const technical = r?.technical ?? 5;
      const weightedRating =
        competitiveness * 0.45 +
        physical * 0.25 +
        tactical * 0.2 +
        technical * 0.1;

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

      const proportionalMin = Math.ceil(
        18 * (availableMatches / Math.max(1, seasonMatchCount)),
      );
      const minRequiredCalls = Math.min(availableMatches, 18, proportionalMin);

      // Prepare week stats early so they can be used in the combined score
      

      const factors: ProposalFactor[] = [];
      let score = 0;
      let forced = false;

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
        lastInjuryMissedEventsMap,
        currentIso,
        weekTrainingCount,
        maxTechnicalTotal,
      } as const;

      const ruleResults = runRules(ruleCtx as any);
      for (const rr of ruleResults) {
        if (rr.forced) forced = true;
        score += rr.delta;
        for (const f of rr.factors) factors.push(f);
      }

      const unavailability = matchUnavailable?.get(playerId);
      const isGoalkeeper = positionPlayers.get(playerId)?.role === "goalkeeper";
      const goalkeeperMayMiss =
        p.isInjured === true ||
        unavailability?.excuseTypeId === INJURY_EXCUSE_ID ||
        unavailability?.excuseTypeId === SANCTION_EXCUSE_ID;
      const locked = isGoalkeeper && !goalkeeperMayMiss;

      if (locked) {
        forced = false;
        factors.push({
          key: "goalkeeperAlwaysCalled",
          label: "Portero: siempre convocado salvo lesión o sanción",
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
        : "Ordenado por mayor score de desconvocatoria";

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
      } as PlayerProposal;
    })
    .filter((item): item is PlayerProposal => item !== null)
    .sort((a, b) => {
      // Forced rules always go first (to be selected as desconvocados)
      if (a.forced !== b.forced) return a.forced ? -1 : 1;
      // Ahora la puntuación es de 'protección': los más bajos son candidatos a desconvocar
      return a.score - b.score;
    });

  const forcedCount = proposals.filter((p) => p.forced).length;
  const targetCount = Math.max(forcedCount, calledIds.length - maxCalledPlayers, 0);

  const { selectedIds, protectedBy, shortfalls } = selectDeconvocations(
    proposals,
    positionPlayers,
    targetCount,
  );
  const selectedSet = new Set(selectedIds);

  const playersWithSelection = proposals.map((p) => {
    const requirement = protectedBy.get(p.playerId);
    const factors = requirement
      ? [
          ...p.factors,
          {
            key: "positionProtection",
            label: protectionReason(requirement),
            value: requiredCount(requirement),
            impact: 0,
          },
        ]
      : p.factors;
    return { ...p, factors, isSelected: selectedSet.has(p.playerId) };
  });

  return {
    generatedAt: new Date().toISOString(),
    targetCount,
    calledCount: calledIds.length,
    selectedIds,
    previousRivalResult,
    players: playersWithSelection,
    positionWarnings: shortfalls,
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
      if (label.includes("puntos por asistencia")) return `${nf0(n)}%`;
      return `${nf0(n)} entrenos`;
    case "weeklyTrainingAccum":
      return `${nf0(n)}%`;
    case "recentRecovery":
      return `${nf0(n)} días`;
    default:
      return Number.isInteger(n) ? new Intl.NumberFormat("es-ES").format(n) : nf2(n);
  }
}
