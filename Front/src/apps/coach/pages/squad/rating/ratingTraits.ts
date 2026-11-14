export type TraitPhase = "withBall" | "withoutBall" | "transitions" | "transversal";

export type TraitDefinition = {
  key: string;
  label: string;
  phase: TraitPhase;
  /** Descriptor de los niveles 1, 3 y 5. */
  anchors: { 1: string; 3: string; 5: string };
};

export type TraitWeight = "key" | "sum" | "indifferent";

export type FitPosition =
  | "centerBack"
  | "fullBack"
  | "defensiveMidfielder"
  | "midfielder"
  | "attackingMidfielder"
  | "winger"
  | "forward";

export const MIN_TRAIT_LEVEL = 1;
export const MAX_TRAIT_LEVEL = 5;

export const TRAIT_PHASE_LABELS: Record<TraitPhase, string> = {
  withBall: "Con balón",
  withoutBall: "Sin balón",
  transitions: "Transiciones",
  transversal: "Transversales",
};

export const FIT_POSITION_LABELS: Record<FitPosition, string> = {
  centerBack: "Central",
  fullBack: "Lateral/Carrilero",
  defensiveMidfielder: "Mediocentro defensivo",
  midfielder: "Mediocentro",
  attackingMidfielder: "Mediapunta",
  winger: "Extremo",
  forward: "Delantero",
};

export const FIT_POSITIONS: FitPosition[] = [
  "centerBack",
  "fullBack",
  "defensiveMidfielder",
  "midfielder",
  "attackingMidfielder",
  "winger",
  "forward",
];

export const TRAIT_CATALOG: TraitDefinition[] = [
  {
    key: "traitOccupiesZone",
    label: "Ocupa su zona y da apoyo",
    phase: "withBall",
    anchors: {
      1: "Se descoloca y no ofrece apoyo ni amplitud",
      3: "Suele estar en su zona pero no siempre ofrece apoyo",
      5: "Siempre ocupa su zona y da la línea de pase adecuada",
    },
  },
  {
    key: "traitBuildsUnderPressure",
    label: "Sale jugando bajo presión",
    phase: "withBall",
    anchors: {
      1: "Pierde el balón o lo despeja cuando le presionan",
      3: "Sale bien con presión moderada",
      5: "Resuelve con criterio y calma incluso bajo presión alta",
    },
  },
  {
    key: "traitBreaksLines",
    label: "Rompe líneas",
    phase: "withBall",
    anchors: {
      1: "Casi siempre juega seguro hacia atrás o hacia el lado",
      3: "Rompe líneas cuando el espacio es claro",
      5: "Rompe líneas con pase o conducción de forma constante",
    },
  },
  {
    key: "traitBeatsOneOnOne",
    label: "Desequilibra 1vs1",
    phase: "withBall",
    anchors: {
      1: "No intenta o pierde casi todos los duelos con balón",
      3: "Supera al rival en situaciones favorables",
      5: "Gana el 1vs1 y genera ventaja de forma habitual",
    },
  },
  {
    key: "traitArrivesAndFinishes",
    label: "Llega al área y finaliza",
    phase: "withBall",
    anchors: {
      1: "No aparece en zona de remate",
      3: "Llega al área algunas veces",
      5: "Aparece en el área con frecuencia y finaliza con criterio",
    },
  },
  {
    key: "traitCoverage",
    label: "Posición y cobertura",
    phase: "withoutBall",
    anchors: {
      1: "Deja su zona y descompensa al equipo",
      3: "Cubre su zona salvo en momentos de presión",
      5: "Siempre está bien posicionado y cubre a los compañeros",
    },
  },
  {
    key: "traitPressing",
    label: "Presiona y orienta",
    phase: "withoutBall",
    anchors: {
      1: "No presiona o lo hace fuera de tiempo",
      3: "Presiona cuando el equipo lo marca",
      5: "Presiona a tiempo y orienta al rival hacia donde se pretende",
    },
  },
  {
    key: "traitDuels",
    label: "Gana duelos",
    phase: "withoutBall",
    anchors: {
      1: "Pierde la mayoría de duelos de suelo y aéreos",
      3: "Compite los duelos con resultado parejo",
      5: "Gana la mayoría de los duelos de suelo y aéreos",
    },
  },
  {
    key: "traitReactsToLoss",
    label: "Reacciona a la pérdida",
    phase: "transitions",
    anchors: {
      1: "Se queda mirando o tarda en reaccionar tras perder el balón",
      3: "Reacciona bien si está cerca del balón",
      5: "Contrapresiona o se repliega de inmediato en cada pérdida",
    },
  },
  {
    key: "traitFirstActionAfterRecovery",
    label: "Primera acción tras recuperar",
    phase: "transitions",
    anchors: {
      1: "Pierde el balón o se frena tras recuperarlo",
      3: "Asegura el balón pero no siempre acelera",
      5: "Su primera acción tras recuperar es rápida y de calidad",
    },
  },
  {
    key: "traitRoleDiscipline",
    label: "Cumple su rol",
    phase: "transversal",
    anchors: {
      1: "No hace lo que el puesto exige en cada fase y zona",
      3: "Cumple su rol en la mayoría de fases",
      5: "Cumple su rol en todas las fases y zonas, partido tras partido",
    },
  },
  {
    key: "traitSustainedIntensity",
    label: "Intensidad sostenida",
    phase: "transversal",
    anchors: {
      1: "Su intensidad cae pronto y no se recupera",
      3: "Mantiene la intensidad la mayor parte del partido",
      5: "Intensidad alta y constante de principio a fin",
    },
  },
];

export function isValidTraitLevel(level: number): boolean {
  return Number.isInteger(level) && level >= MIN_TRAIT_LEVEL && level <= MAX_TRAIT_LEVEL;
}

// ---------------------------------------------------------------------------
// Puestos unificados sobre las 14 demarcaciones de DemarcationMaster
// ---------------------------------------------------------------------------

const POSITION_BY_DEMARCATION: Record<number, FitPosition> = {
  2: "fullBack",
  3: "fullBack",
  4: "centerBack",
  5: "centerBack",
  6: "midfielder",
  7: "defensiveMidfielder",
  8: "attackingMidfielder",
  9: "midfielder",
  10: "midfielder",
  11: "forward",
  12: "forward",
  13: "winger",
  14: "winger",
};

/** El portero (1) y las demarcaciones desconocidas no tienen puesto de encaje. */
export function positionForDemarcation(demarcationId: number): FitPosition | null {
  return POSITION_BY_DEMARCATION[demarcationId] ?? null;
}

export function candidatePositions(
  activePositionId: number | null | undefined,
  possibleDemarcationIds: number[] | null | undefined,
): FitPosition[] {
  const ids = [...(activePositionId != null ? [activePositionId] : []), ...(possibleDemarcationIds ?? [])];
  const positions = ids
    .map(positionForDemarcation)
    .filter((position): position is FitPosition => position !== null);
  return [...new Set(positions)];
}

// ---------------------------------------------------------------------------
// Pesos por defecto (mismo orden que TRAIT_CATALOG)
// ---------------------------------------------------------------------------

const K: TraitWeight = "key";
const S: TraitWeight = "sum";
const I: TraitWeight = "indifferent";

// OccupiesZone, BuildsUnderPressure, BreaksLines, BeatsOneOnOne, ArrivesAndFinishes,
// Coverage, Pressing, Duels, ReactsToLoss, FirstActionAfterRecovery, RoleDiscipline, SustainedIntensity
const WEIGHT_MATRIX: Record<FitPosition, TraitWeight[]> = {
  centerBack: [K, K, S, I, I, K, S, K, K, S, K, S],
  fullBack: [K, S, S, K, S, K, S, S, K, K, K, K],
  defensiveMidfielder: [K, K, S, I, I, K, K, K, K, S, K, S],
  midfielder: [S, S, K, S, K, S, K, S, K, K, K, K],
  attackingMidfielder: [S, S, K, K, K, I, S, I, S, K, S, K],
  winger: [S, I, S, K, K, S, K, S, K, K, S, K],
  forward: [S, I, S, K, K, I, K, K, S, K, S, K],
};

export const DEFAULT_TRAIT_WEIGHTS: Record<FitPosition, Record<string, TraitWeight>> = Object.fromEntries(
  FIT_POSITIONS.map((position) => [
    position,
    Object.fromEntries(TRAIT_CATALOG.map((trait, index) => [trait.key, WEIGHT_MATRIX[position][index]])),
  ]),
) as Record<FitPosition, Record<string, TraitWeight>>;

const WEIGHT_VALUE: Record<TraitWeight, number> = { key: 3, sum: 1, indifferent: 0 };

/**
 * Media ponderada de los niveles (1–5) con los pesos del puesto. Ignora rasgos indiferentes y sin nivel.
 * Devuelve null si ningún rasgo que cuenta tiene nivel.
 */
export function calculateFit(
  levels: Record<string, number>,
  weights: Record<string, TraitWeight>,
): number | null {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const [traitKey, weight] of Object.entries(weights)) {
    const value = WEIGHT_VALUE[weight];
    const level = levels[traitKey];
    if (value === 0 || level == null) continue;
    weightedSum += level * value;
    totalWeight += value;
  }
  if (totalWeight === 0) return null;
  return Math.round((weightedSum / totalWeight) * 10) / 10;
}
