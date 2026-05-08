import type { Rule, RuleResult, RuleContext } from "./types";

function getPositionGroupLocal(position: string | null | undefined): string {
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

const FORMATION_STARTERS: Record<string, number> = {
  portero: 1,
  defensa: 4,
  centrocampista: 5,
  delantero: 1,
  unknown: 0,
};

export default function positionCoverageRule(ctx: RuleContext, _prev: Record<string, RuleResult>): RuleResult {
  const { player, playerById, calledIds, positionGroupCounts, ratings } = ctx;
  const posGroup = getPositionGroupLocal(player.position);
  if (posGroup === "unknown") return { factors: [], delta: 0 };

  const calledInGroup = positionGroupCounts.get(posGroup) ?? 0;
  const remainingIfDeconvoked = calledInGroup - 1;
  const starters = FORMATION_STARTERS[posGroup];
  const shortfall = starters - remainingIfDeconvoked;

  let positionDelta = 0;
  let positionLabel = "";
  // Expose intermediate values for UI debugging: baseCoverageBonus and qualityFactor
  let baseCoverageBonus = 0;
  let qualityFactor = 1;

  if (shortfall >= 2) {
    positionDelta = shortfall * 20;
    positionLabel = `Escasez crítica de ${posGroup}s (${remainingIfDeconvoked} quedarían, necesarios ${starters})`;
  } else if (shortfall === 1) {
    positionDelta = 20;
    positionLabel = `Sin suplente en ${posGroup} (quedarían justo ${starters})`;
  } else if (shortfall === 0) {
    positionDelta = 8;
    positionLabel = `Solo 1 suplente en ${posGroup}`;
  } else {
    const surplus = -shortfall;
    const groupRatings = calledIds
      .filter((id) => id !== ctx.playerId && getPositionGroupLocal(playerById.get(id)?.position) === posGroup)
      .map((id) => {
        const gr = ratings[id];
        const competitiveness = gr?.competitiveness ?? 5;
        const physical = gr?.physical ?? 5;
        const tactical = gr?.tactical ?? 5;
        const technical = gr?.technical ?? 5;
        return competitiveness * 0.45 + physical * 0.25 + tactical * 0.2 + technical * 0.1;
      });
    const lowerLevelPlayers = groupRatings.filter((rating) => rating < ctx.weightedRating).length;
    const higherLevelPlayers = groupRatings.filter((rating) => rating > ctx.weightedRating).length;
    const groupAverageRating = groupRatings.length > 0
      ? groupRatings.reduce((sum, rating) => sum + rating, 0) / groupRatings.length
      : ctx.weightedRating;

    baseCoverageBonus = Math.min(6, surplus * 2);
    const ratingGap = ctx.weightedRating - groupAverageRating;
    const qualityReduction = ratingGap > 0 ? Math.max(0, Math.min(1, ratingGap / 3)) : 0;
    const crowdPenalty = lowerLevelPlayers > higherLevelPlayers ? 0.25 : 0;
    qualityFactor = Math.max(0.2, 1 - qualityReduction - crowdPenalty);

    positionDelta = -baseCoverageBonus * qualityFactor;
    positionLabel = ratingGap > 0 && lowerLevelPlayers > higherLevelPlayers
      ? `Cobertura holgada en ${posGroup}: sobran ${surplus} suplentes y el jugador está por encima de ellos`
      : `Cobertura holgada en ${posGroup}: sobran ${surplus} suplentes y hay margen en ese puesto`;
  }

  // Main factor describing position coverage impact
  const mainFactor = {
    key: "positionCoverage",
    label: positionLabel,
    value: remainingIfDeconvoked,
    impact: Number(positionDelta.toFixed(2)),
  };

  // Extra debug/visibility factors to show the numbers used in the UI
  const baseCoverageFactor = {
    key: "positionCoverage.baseCoverageBonus",
    label: "Penalización por número de jugadores en ese puesto",
    value: baseCoverageBonus,
    // show raw negative penalty if qualityFactor were 1
    impact: Number((-baseCoverageBonus).toFixed(2)),
  };

  // The quality adjustment brings the raw penalty closer to the final delta.
  // qualityAdjustment = mainDelta - baseImpact = (-base*quality) - (-base) = base*(1 - quality)
  const qualityAdjustment = Number((baseCoverageBonus * (1 - qualityFactor)).toFixed(2));
  const qualityFactorFactor = {
    key: "positionCoverage.qualityFactor",
    label: "Ajuste por calidad (reducción de la penalización por calidad del jugador)",
    value: Number(qualityFactor.toFixed(2)),
    impact: qualityAdjustment,
  };

  return { factors: [mainFactor, baseCoverageFactor, qualityFactorFactor], delta: positionDelta };
}
