export type RivalDifficulty = "easy" | "medium" | "hard";

export type ProtectionWindows = {
  /** Matchdays a technical deconvocation protects the player. */
  technical: number;
  /** Matchdays an absence by injury or illness counts as rest. */
  injuryRest: number;
  /** Matchdays a deconvocation for any other cause (family, studies...) protects the player. */
  otherCause: number;
};

export const DEFAULT_PROTECTION_WINDOWS: ProtectionWindows = { technical: 8, injuryRest: 1, otherCause: 4 };

export type DifficultyThresholds = {
  /** Own win probability below which the rival is hard. */
  hardBelow: number;
  /** Own win probability above which the rival is easy. */
  easyAbove: number;
};

export const DEFAULT_DIFFICULTY_THRESHOLDS: DifficultyThresholds = { hardBelow: 0.4, easyAbove: 0.65 };

export function classifyRivalDifficulty(
  ownWinProbability: number | null | undefined,
  thresholds: DifficultyThresholds = DEFAULT_DIFFICULTY_THRESHOLDS,
): RivalDifficulty {
  if (ownWinProbability == null || !Number.isFinite(ownWinProbability)) return "medium";
  if (ownWinProbability < thresholds.hardBelow) return "hard";
  if (ownWinProbability > thresholds.easyAbove) return "easy";
  return "medium";
}

export type ProtectionKind = "technicalWindow" | "injuryRest" | "otherCause" | "minCalls";

export type Protection = { kind: ProtectionKind; reason: string };

type ProtectionInput = {
  /** Matchdays since the last technical deconvocation (1 = the previous matchday); null when none. */
  technicalAgo: number | null;
  /** Matchdays since the last absence by injury or illness (1 = the previous matchday); null when none. */
  injuryAgo: number | null;
  /** Matchdays since the last deconvocation for another cause (not technical, not injury); null when none. */
  otherAgo?: number | null;
  /** Name of that cause, e.g. "Problema familiar". */
  otherReason?: string | null;
  calledCount: number;
  minRequiredCalls: number;
};

function matchdays(n: number): string {
  return n === 1 ? "1 jornada" : `${n} jornadas`;
}

/**
 * First rule that keeps the player called; only one reason is reported. When several causes protect,
 * the most recent deconvocation is the one shown (technical first on a tie), then the minimum of calls.
 */
export function protectionOf(
  input: ProtectionInput,
  windows: ProtectionWindows = DEFAULT_PROTECTION_WINDOWS,
): Protection | null {
  const { technicalAgo, injuryAgo, otherAgo = null, otherReason = null, calledCount, minRequiredCalls } = input;
  const causes: Array<{ ago: number; kind: ProtectionKind; reason: string }> = [];
  if (technicalAgo != null && technicalAgo <= windows.technical) {
    causes.push({ ago: technicalAgo, kind: "technicalWindow", reason: `Protegido: desconvocado hace ${matchdays(technicalAgo)}` });
  }
  if (injuryAgo != null && injuryAgo <= windows.injuryRest) {
    const when = injuryAgo === 1 ? "la jornada anterior" : `hace ${matchdays(injuryAgo)}`;
    causes.push({ ago: injuryAgo, kind: "injuryRest", reason: `Protegido: no vino ${when} por lesión` });
  }
  if (otherAgo != null && otherAgo <= windows.otherCause) {
    const cause = otherReason?.trim() ? otherReason.trim().toLowerCase() : "otro motivo";
    causes.push({ ago: otherAgo, kind: "otherCause", reason: `Protegido: desconvocado hace ${matchdays(otherAgo)} por ${cause}` });
  }
  const recent = causes.sort((x, y) => x.ago - y.ago)[0];
  if (recent) return { kind: recent.kind, reason: recent.reason };
  if (calledCount < minRequiredCalls) {
    const missing = minRequiredCalls - calledCount;
    const calls = missing === 1 ? "1 convocatoria" : `${missing} convocatorias`;
    const verb = missing === 1 ? "falta" : "faltan";
    return {
      kind: "minCalls",
      reason: `Protegido: le ${verb} ${calls} para llegar al mínimo exigido (${minRequiredCalls})`,
    };
  }
  return null;
}

export type Criterion = "consecutive" | "surplus" | "technicalTotal" | "attendance" | "rating";

export type FairnessMetrics = {
  /** Consecutive matchdays called without rest, newest first. */
  consecutive: number;
  /** Calls above the player's minimum. */
  surplus: number;
  technicalTotal: number;
  /** Season attendance in 10% steps (0-10). */
  attendanceBucket: number;
  /** Weighted rating: the last tiebreak, or right after the call surplus against a hard rival. */
  rating: number;
};

export function attendanceBucket(rate: number | null): number {
  if (rate == null || !Number.isFinite(rate)) return 10;
  return Math.floor(Math.max(0, Math.min(1, rate)) * 10);
}

/**
 * Negative order: `a` is deconvoked before `b`. The first criterion where they differ decides:
 * more consecutive matchdays, larger call surplus, fewer technical deconvocations, lower attendance
 * and lower rating, so the best players are the last to rest. Against a hard rival the rating moves
 * right after the call surplus.
 */
export function compareFairness(
  a: FairnessMetrics,
  b: FairnessMetrics,
  difficulty: RivalDifficulty,
): { order: number; criterion: Criterion | null } {
  const consecutive: [Criterion, number] = ["consecutive", b.consecutive - a.consecutive];
  const surplus: [Criterion, number] = ["surplus", b.surplus - a.surplus];
  const technicalTotal: [Criterion, number] = ["technicalTotal", a.technicalTotal - b.technicalTotal];
  const attendance: [Criterion, number] = ["attendance", a.attendanceBucket - b.attendanceBucket];
  const rating: [Criterion, number] = ["rating", a.rating - b.rating];
  const steps =
    difficulty === "hard"
      ? [consecutive, surplus, rating, technicalTotal, attendance]
      : [consecutive, surplus, technicalTotal, attendance, rating];
  for (const [criterion, diff] of steps) {
    if (diff !== 0) return { order: diff, criterion };
  }
  return { order: 0, criterion: null };
}

function percent(bucket: number): string {
  return `${bucket * 10}%`;
}

function nf(value: number): string {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(value);
}

/**
 * Texts for a deciding criterion. `chosen`/`compare` describe the player proposed (metrics `a`)
 * against `peerName` (metrics `b`); `notChosen` describes `peerName` being kept instead of `chosenName`.
 */
export function describeCriterion(
  criterion: Criterion,
  a: FairnessMetrics,
  b: FairnessMetrics,
  peerName: string,
  chosenName: string,
  difficulty: RivalDifficulty = "medium",
): { chosen: string; compare: string; notChosen: string } {
  switch (criterion) {
    case "consecutive":
      return {
        chosen: `lleva ${a.consecutive} jornadas seguidas convocado sin descansar`,
        compare: `${peerName} lleva ${b.consecutive}`,
        notChosen: `Se desconvoca a ${chosenName} en su lugar: lleva más jornadas seguidas convocado (${a.consecutive} frente a ${b.consecutive})`,
      };
    case "surplus":
      return {
        chosen: `tiene ${a.surplus} convocatorias sobre su mínimo`,
        compare: `${peerName} tiene ${b.surplus}`,
        notChosen: `Se desconvoca a ${chosenName} en su lugar: tiene más convocatorias sobre su mínimo (${a.surplus} frente a ${b.surplus})`,
      };
    case "technicalTotal":
      return {
        chosen: `tiene menos desconvocatorias técnicas acumuladas (${a.technicalTotal})`,
        compare: `${peerName} tiene ${b.technicalTotal}`,
        notChosen: `Se desconvoca a ${chosenName} en su lugar: acumula menos desconvocatorias técnicas (${a.technicalTotal} frente a ${b.technicalTotal})`,
      };
    case "attendance":
      return {
        chosen: `tiene menor asistencia a entrenamientos (${percent(a.attendanceBucket)})`,
        compare: `${peerName} tiene ${percent(b.attendanceBucket)}`,
        notChosen: `Se desconvoca a ${chosenName} en su lugar: asiste menos a entrenamientos (${percent(a.attendanceBucket)} frente a ${percent(b.attendanceBucket)})`,
      };
    case "rating":
      return {
        chosen:
          difficulty === "hard"
            ? `tiene menor nivel (${nf(a.rating)}) y el rival es difícil`
            : `tiene menor nivel (${nf(a.rating)}): es el último desempate`,
        compare: `${peerName} tiene nivel ${nf(b.rating)} y él ${nf(a.rating)}`,
        notChosen: `Se desconvoca a ${chosenName} en su lugar: tiene menor nivel (${nf(a.rating)} frente a ${nf(b.rating)})`,
      };
  }
}

/** Values of a criterion for the player proposed (a) and a peer (b), e.g. "6 frente a 4". */
export function formatCriterionValues(criterion: Criterion, a: FairnessMetrics, b: FairnessMetrics): string {
  switch (criterion) {
    case "consecutive":
      return `${a.consecutive} frente a ${b.consecutive}`;
    case "surplus":
      return `${a.surplus} frente a ${b.surplus}`;
    case "technicalTotal":
      return `${a.technicalTotal} frente a ${b.technicalTotal}`;
    case "attendance":
      return `${percent(a.attendanceBucket)} frente a ${percent(b.attendanceBucket)}`;
    case "rating":
      return `${nf(a.rating)} frente a ${nf(b.rating)}`;
  }
}

export const CRITERION_NAMES: Record<Criterion, string> = {
  consecutive: "jornadas seguidas",
  surplus: "excedente de convocatorias",
  technicalTotal: "desconvocatorias técnicas",
  attendance: "asistencia",
  rating: "nivel",
};
