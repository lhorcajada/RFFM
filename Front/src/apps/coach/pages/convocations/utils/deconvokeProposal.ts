import type { SportEventResponse } from "../../../services/sportEventService";
import type { PlayerResponse } from "../../../services/teamplayerService";
import type { PlayerRating } from "../../../types/playerRating";
import type { MatchColumn } from "../components/convocationMatchDetail.types";
import type { GridCell } from "../components/convocationMatchDetail.types";
import type { SeasonPlayerStats } from "../components/simulation/liveMatch.types";

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
  isSelected: boolean;
  forced: boolean;
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
  currentDate: string | undefined;
  currentEventId: string | null;
  currentRival: string | null;
  weekTrainingStats: Map<string, WeeklyTrainingStats>;
  weekTrainingCount: number;
  maxCalledPlayers?: number;
  /** Starts count per teamPlayerId, computed from match-participation lineups */
  gridStartsCountMap?: Map<string, number>;
};

export type WeeklyTrainingStats = {
  totalTrainings: number;
  attendedTrainings: number;
  attendedTrainingsSeason: number;
  totalTrainingsSeason: number;
  knownUnavailableTrainings: number;
  unresolvedTrainings: number;
};

const NOT_CALLED_NAMES = new Set(["Deconvoke", "No disponible"]);

// ── Position groups ──────────────────────────────────────────────────────────

type PositionGroup = "portero" | "defensa" | "centrocampista" | "delantero" | "unknown";

function getPositionGroup(position: string | null | undefined): PositionGroup {
  const p = (position ?? "").toLowerCase();
  if (p.includes("portero") || p.includes("keeper") || p.includes("arquero") || p === "gk" || p === "por") return "portero";
  if (p.includes("defensa") || p.includes("central") || p.includes("lateral") || p.includes("stopper") || p.includes("libero")) return "defensa";
  if (
    p.includes("centrocampista") || p.includes("medio") || p.includes("pivote") ||
    p.includes("mediapunta") || p.includes("enganche") || p.includes("extremo")
  ) return "centrocampista";
  if (p.includes("delantero") || p.includes("punta") || p.includes("ariete") || p.includes("goleador")) return "delantero";
  return "unknown";
}

// Formation 1-4-2-3-1: starters and comfortable minimum convoked per position group
const FORMATION_STARTERS: Record<PositionGroup, number> = {
  portero: 1,
  defensa: 4,
  centrocampista: 5, // 2 MC + 3 mediapuntas/extremos
  delantero: 1,
  unknown: 0,
};

const POSITION_MIN_CONVOKED: Record<PositionGroup, number> = {
  portero: 2,
  defensa: 5,
  centrocampista: 6,
  delantero: 2,
  unknown: 0,
};

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
    currentDate,
    currentEventId,
    currentRival,
    weekTrainingStats,
    weekTrainingCount,
    maxCalledPlayers = 18,
    gridStartsCountMap,
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

  // Pre-compute how many called players belong to each position group
  const positionGroupCounts = new Map<PositionGroup, number>();
  for (const pid of calledIds) {
    const group = getPositionGroup(playerById.get(pid)?.position);
    positionGroupCounts.set(group, (positionGroupCounts.get(group) ?? 0) + 1);
  }

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
      let injuryAbsencesInStreak = 0;
      seasonColumns.forEach((col, i) => {
        const cell = enrichedGrid.get(col.eventId)?.get(playerId);
        if (isNonTechnicalAbsence(cell)) {
          nonTechnicalAbsences++;
        }
        if (isInjuryAbsence(cell)) {
          injuryAbsences++;
          if (i < technicalStreak) injuryAbsencesInStreak++;
        }
      });

      // For team-necessity, absences by injury/personal reasons must not penalize the player.
      // Use the player's available matches as denominator for call/start rates.
      const seasonMatchCount = seasonColumns.length + 1;
      const availableMatches = Math.max(0, seasonMatchCount - nonTechnicalAbsences);
      const callRate = clamp01(calledCount / Math.max(1, availableMatches));
      const startRate = startsDataAvailable
        ? clamp01(startsCount / Math.max(1, calledCount))
        : 0;
      const competitivenessRate = clamp01(competitiveness / 10);
      const necessity = startsDataAvailable
        ? competitivenessRate * 0.75 + startRate * 0.1 + callRate * 0.05
        : competitivenessRate * 0.8 + callRate * 0.2;

      // Effective streak: discount rounds where the player was injured
      // (they couldn't have been technically deconvoked anyway)
      const effectiveStreak = Math.max(0, technicalStreak - injuryAbsencesInStreak);

      const proportionalMin = Math.ceil(
        18 * (availableMatches / Math.max(1, seasonMatchCount)),
      );
      const minRequiredCalls = Math.min(availableMatches, 18, proportionalMin);

      const factors: ProposalFactor[] = [];
      let score = 0;
      let forced = false;

      const staleDelta = Math.min(28, effectiveStreak * 1.9);
      score += staleDelta;
      factors.push({
        key: "streak",
        label: injuryAbsencesInStreak > 0
          ? `Jornadas sin desconvocatoria técnica (${injuryAbsencesInStreak} de lesión descontadas)`
          : "Jornadas sin desconvocatoria técnica",
        value: effectiveStreak,
        impact: Number(staleDelta.toFixed(2)),
      });

      const historyDelta = Math.max(-18, -technicalTotal * 2.3);
      score += historyDelta;
      factors.push({
        key: "technicalTotal",
        label: "Desconvocatorias técnicas acumuladas",
        value: technicalTotal,
        impact: Number(historyDelta.toFixed(2)),
      });

      // Nivel ponderado (escala 1-10): siempre resta puntos al score.
      // A mayor nivel, más resta (más protegido). Tabla por tramo:
      //  <1      →  -3  |  [1,2) → -5  |  [2,3) → -8  |  [3,4) → -12
      //  [4,5)  → -17  |  [5,6) → -23 |  [6,7) → -30 |  [7,8) → -32
      //  [8,9)  → -34  |  [9,10) → -36 | >=10 → -40
      const QUALITY_PENALTY = [-3, -5, -8, -12, -17, -23, -30, -32, -34, -36, -40] as const;
      const qualityFloor = Math.min(10, Math.max(0, Math.floor(weightedRating)));
      const qualityDelta = QUALITY_PENALTY[qualityFloor];
      score += qualityDelta;
      factors.push({
        key: "rating",
        label: "Nivel ponderado (Comp > Fis > Tac > Tec)",
        value: Number(weightedRating.toFixed(2)),
        impact: Number(qualityDelta.toFixed(2)),
      });

      const necessityDelta = -necessity * 28;
      score += necessityDelta;
      factors.push({
        key: "necessity",
        label: "Necesidad para el equipo (nivel competitivo + titularidades + convocatorias)",
        value: Number((necessity * 100).toFixed(2)),
        impact: Number(necessityDelta.toFixed(2)),
      });

      if (calledCount < minRequiredCalls) {
        const deficit = minRequiredCalls - calledCount;
        const minDelta = -Math.min(24, deficit * 4.5);
        score += minDelta;
        factors.push({
          key: "minimum",
          label: "Protección por mínimo de convocatorias",
          value: deficit,
          impact: Number(minDelta.toFixed(2)),
        });
      } else {
        factors.push({
          key: "minimum",
          label: "Cumple mínimo proporcional de convocatorias",
          value: calledCount,
          impact: 0,
        });
      }

      // Position coverage: penalise deconvoking a player when their position group
      // would fall below the formation's starter count or comfortable minimum.
      const posGroup = getPositionGroup(p.position);
      if (posGroup !== "unknown") {
        const calledInGroup = positionGroupCounts.get(posGroup) ?? 0;
        const remainingIfDeconvoked = calledInGroup - 1;
        const starters = FORMATION_STARTERS[posGroup];
        const shortfall = starters - remainingIfDeconvoked; // >0 means team would be short
        let positionDelta: number;
        let positionLabel: string;
        if (shortfall >= 2) {
          positionDelta = -(shortfall * 20);
          positionLabel = `Escasez crítica de ${posGroup}s (${remainingIfDeconvoked} quedarían, necesarios ${starters})`;
        } else if (shortfall === 1) {
          positionDelta = -20;
          positionLabel = `Sin suplente en ${posGroup} (quedarían justo ${starters})`;          
        } else if (shortfall === 0) {
          positionDelta = -8;
          positionLabel = `Solo 1 suplente en ${posGroup}`;
        } else {
          // surplus available: slight positive if very well covered
          const surplus = -shortfall;
          positionDelta = Math.min(6, surplus * 2);
          positionLabel = `Cobertura holgada en ${posGroup} (${surplus} suplente${surplus !== 1 ? "s" : ""} extra)`;
        }
        score += positionDelta;
        factors.push({
          key: "positionCoverage",
          label: positionLabel,
          value: remainingIfDeconvoked,
          impact: Number(positionDelta.toFixed(2)),
        });
      }

      if (previousRivalResult) {
        // Base magnitude depends on result type:
        // loss = higher stakes, draw = medium, win = can afford to rotate more
        const resultFactor =
          previousRivalResult.result === "loss"
            ? 22
            : previousRivalResult.result === "draw"
              ? 14
              : 8;
        // When the margin was large (≥7), the coach can rest key players →
        // more necessary players accumulate more deconvoke points.
        // When the margin was tight (<7), the coach keeps the stars →
        // less necessary players accumulate more points.
        const isAbultado = previousRivalResult.goalDiff >= 7;
        const rivalDelta = isAbultado
          ? resultFactor * necessity          // big margin: rest key players
          : resultFactor * (1 - necessity);   // tight: rest fringe players
        score += rivalDelta;
        const abultadoLabel = isAbultado
          ? `Resultado abultado (≥7 goles) — se pueden descansar titulares`
          : `Resultado ajustado (<7 goles) — se protege a los más necesarios`;
        factors.push({
          key: "rivalResult",
          label: `${abultadoLabel} vs ${previousRivalResult.rival} (${previousRivalResult.scoreText})`,
          value: Number((necessity * 100).toFixed(0)),
          impact: Number(rivalDelta.toFixed(2)),
        });
      }

      if (p.isInjured) {
        forced = true;
        score += 120;
        factors.push({
          key: "injured",
          label: "Lesionado: desconvocatoria automática",
          value: 1,
          impact: 120,
        });
      }

      const weekStats =
        weekTrainingStats.get(playerId) ??
        {
          totalTrainings: weekTrainingCount,
          attendedTrainings: 0,
          attendedTrainingsSeason: 0,
          totalTrainingsSeason: 0,
          knownUnavailableTrainings: 0,
          unresolvedTrainings: weekTrainingCount,
        };

      if (weekTrainingCount > 0) {
        const noWeeklyAttendance = weekStats.attendedTrainings === 0;
        const hasKnownUnavailable = weekStats.knownUnavailableTrainings > 0;
        const allWeeklyTrainingsResolved = weekStats.unresolvedTrainings === 0;
        const resolvedWeeklyTrainings = Math.max(
          0,
          weekStats.totalTrainings - weekStats.knownUnavailableTrainings - weekStats.unresolvedTrainings,
        );
        const weeklyAttendanceRate = resolvedWeeklyTrainings > 0
          ? clamp01(weekStats.attendedTrainings / resolvedWeeklyTrainings)
          : 0;

        if (noWeeklyAttendance && (hasKnownUnavailable || allWeeklyTrainingsResolved)) {
          forced = true;
          score += 110;
          factors.push({
            key: "weeklyTraining",
            label: "Semana de partido sin asistir a entrenamientos",
            value: weekStats.attendedTrainings,
            impact: 110,
          });
        } else {
          const weeklyAttendanceDelta = -weeklyAttendanceRate * 12;
          score += weeklyAttendanceDelta;
          factors.push({
            key: "weeklyTraining",
            label: "Asistencia semanal a entrenamientos",
            value: Number((weeklyAttendanceRate * 100).toFixed(2)),
            impact: Number(weeklyAttendanceDelta.toFixed(2)),
          });

          const attendedTrainingsSeason = Number.isFinite(weekStats.attendedTrainingsSeason)
            ? weekStats.attendedTrainingsSeason
            : 0;
          const totalTrainingsSeason = Number.isFinite(weekStats.totalTrainingsSeason)
            ? Math.max(0, weekStats.totalTrainingsSeason)
            : 0;
          // Weighted by season attended-trainings count (main driver) plus
          // season coverage (secondary), and snapped to integer points so
          // nearby players don't collapse to the same displayed score.
          const seasonCoverage = totalTrainingsSeason > 0
            ? clamp01(attendedTrainingsSeason / totalTrainingsSeason)
            : 0;
          const byVolume = attendedTrainingsSeason * 0.55;
          const byCoverage = seasonCoverage * 8;
          const trainingAccumDelta = -Math.min(50, Math.floor(byVolume + byCoverage));
          score += trainingAccumDelta;
          factors.push({
            key: "weeklyTrainingAccum",
            label: "Acumulado de entrenamientos asistidos (temporada)",
            value: attendedTrainingsSeason,
            impact: Number(trainingAccumDelta.toFixed(2)),
          });
        }
      }

      const lastInjuryEnd = lastInjuryEndMap.get(playerId) ?? null;
      if (!p.isInjured && currentIso && lastInjuryEnd) {
        const days = diffDays(lastInjuryEnd.slice(0, 10), currentIso);
        if (days >= 0 && days <= 7) {
          forced = true;
          score += 100;
          factors.push({
            key: "recentRecovery",
            label: "Solo una semana desde el alta de lesión",
            value: days,
            impact: 100,
          });
        }
      }

      const summary = forced
        ? "Regla obligatoria de disponibilidad física aplicada"
        : "Ordenado por mayor score de desconvocatoria";

      return {
        playerId,
        displayName,
        position: p.position ?? null,
        isSelected: false as boolean,
        forced,
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
      if (a.forced !== b.forced) return a.forced ? -1 : 1;
      return b.score - a.score;
    });

  const forcedCount = proposals.filter((p) => p.forced).length;
  const targetCount = Math.max(forcedCount, calledIds.length - maxCalledPlayers, 0);
  let selectedIds = proposals.slice(0, targetCount).map((p) => p.playerId);

  // Ensure at least one goalkeeper remains convoked after deconvocations.
  function isGoalkeeper(proposal: PlayerProposal): boolean {
    const pos = (proposal.position ?? "").toLowerCase();
    return pos.includes("portero") || pos === "gk" || pos === "por" || pos.includes("goalkeeper");
  }
  const selectedSet0 = new Set(selectedIds);
  const remainingGoalkeepers = proposals.filter((p) => isGoalkeeper(p) && !selectedSet0.has(p.playerId));
  if (remainingGoalkeepers.length === 0) {
    // Find the selected goalkeeper with the lowest score (least worthy of deconvocation) and protect them
    const selectedGoalkeepers = proposals.filter((p) => isGoalkeeper(p) && selectedSet0.has(p.playerId));
    if (selectedGoalkeepers.length > 0) {
      const keepGk = selectedGoalkeepers.reduce((best, cur) => cur.score < best.score ? cur : best);
      // Remove protected goalkeeper and replace with next best non-selected candidate
      const replacement = proposals.find((p) => !selectedSet0.has(p.playerId) && p.playerId !== keepGk.playerId);
      selectedIds = selectedIds.filter((id) => id !== keepGk.playerId);
      if (replacement) selectedIds = [...selectedIds, replacement.playerId];
    }
  }

  const selectedSet = new Set(selectedIds);

  const playersWithSelection = proposals.map((p) => ({
    ...p,
    isSelected: selectedSet.has(p.playerId),
  }));

  return {
    generatedAt: new Date().toISOString(),
    targetCount,
    calledCount: calledIds.length,
    selectedIds,
    previousRivalResult,
    players: playersWithSelection,
  };
}
