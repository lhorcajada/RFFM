export const RULE_CONDITIONS = [
  "injured",
  "weeklyTraining",
  "recentRecovery",
  "recentDeconvocation",
  "otherDeconvocation",
  "injuryRest",
  "lowMinutes",
  "minCalls",
  "positionMinimums",
  "rivalDifficulty",
  "rating",
] as const;

export type RuleCondition = (typeof RULE_CONDITIONS)[number];

export type RuleNumbers = Record<string, number>;

export type DeconvocationRuleConfig = {
  condition: RuleCondition;
  text: string;
  points: RuleNumbers;
  weights: RuleNumbers;
};

export type NumberField = { key: string; label: string; default: number; min: number; max: number };

export type ConditionDefinition = {
  title: string;
  description: string;
  defaultText: string;
  /** Placeholders (`{name}`) the text can use, shown as a hint in the editor. */
  placeholders?: string[];
  /** Forces the deconvocation of the player when it triggers. */
  mandatory?: boolean;
  points: NumberField[];
  weights: NumberField[];
};

const f = (key: string, label: string, def: number, min = -1000, max = 1000): NumberField => ({
  key,
  label,
  default: def,
  min,
  max,
});

export const RULE_CATALOG: Record<RuleCondition, ConditionDefinition> = {
  injured: {
    title: "Lesionado",
    description: "Desconvocatoria automática de los lesionados.",
    defaultText: "Lesionado: desconvocatoria automática",
    mandatory: true,
    points: [],
    weights: [],
  },
  weeklyTraining: {
    title: "Asistencia a entrenamientos de la semana",
    description: "Sin asistir a ningún entrenamiento de la semana se fuerza la desconvocatoria.",
    defaultText: "Semana de partido sin asistir a entrenamientos",
    mandatory: true,
    points: [],
    weights: [
      f("reliableAttendance", "Asistencia de temporada que evita forzar (0-1)", 0.8, 0, 1),
      f("penaltyHalf", "Penalización por imprevisto o problema familiar (0-1)", 0.5, 0, 1),
      f("penaltyThreeQuarters", "Penalización por estudios, enfermedad o cita médica (0-1)", 0.75, 0, 1),
    ],
  },
  recentRecovery: {
    title: "Recuperación reciente de lesión",
    description: "Desconvoca a quien acaba de recibir el alta de una lesión larga.",
    defaultText: "En recuperación de lesión",
    mandatory: true,
    points: [],
    weights: [],
  },
  recentDeconvocation: {
    title: "Desconvocado por decisión técnica",
    description: "Protege de una nueva desconvocatoria a quien fue desconvocado por decisión técnica hace poco.",
    defaultText: "Desconvocado por decisión técnica en las últimas jornadas",
    points: [f("window", "Jornadas de protección", 8, 0, 30)],
    weights: [],
  },
  otherDeconvocation: {
    title: "Desconvocado por otro motivo",
    description: "Protege de una nueva desconvocatoria a quien fue desconvocado hace poco por otra causa (problema familiar, estudios, imprevisto...), sin contar lesiones.",
    defaultText: "Desconvocado por otro motivo en las últimas jornadas",
    points: [f("window", "Jornadas de protección", 4, 0, 30)],
    weights: [],
  },
  injuryRest: {
    title: "Descanso por lesión",
    description: "Una ausencia por lesión o enfermedad, aunque sea leve, cuenta como descanso y protege unas jornadas.",
    defaultText: "No vino por lesión: cuenta como descanso",
    points: [f("window", "Jornadas de protección", 1, 0, 30)],
    weights: [],
  },
  lowMinutes: {
    title: "Pocos minutos en el último partido",
    description:
      "Protege de la desconvocatoria a quien jugó menos de unos minutos en el último partido, incluido quien fue convocado y no llegó a jugar. Solo vale para esta jornada y no se aplica ante un rival difícil.",
    defaultText: "Jugó pocos minutos en el último partido",
    points: [f("minutes", "Minutos por debajo de los cuales se protege", 20, 1, 120)],
    weights: [],
  },
  minCalls: {
    title: "Mínimo de convocatorias",
    description:
      "Cada jugador debería ser convocado al menos su reparto justo de partidos (partidos que pudo jugar × plazas de la convocatoria ÷ plantilla). Con el porcentaje lo exiges más o menos: 100 % es el cálculo base, 0 % lo desactiva. Quien no llega queda protegido.",
    defaultText: "Aún no llega al mínimo de convocatorias",
    points: [f("percent", "Porcentaje del reparto justo que se exige", 100, 0, 200)],
    weights: [],
  },
  positionMinimums: {
    title: "Mínimo por posición",
    description:
      "Jugadores que deben quedar convocados en cada posición. No se propone desconvocar a quien dejaría su posición por debajo del mínimo. Un 0 desactiva esa posición.",
    defaultText: "Mínimo de jugadores por posición",
    points: [
      f("goalkeeper", "Porteros", 2, 0, 5),
      f("fullBack", "Laterales", 3, 0, 8),
      f("centreBack", "Centrales", 3, 0, 8),
      f("centralMid", "Medios centro", 4, 0, 8),
      f("wide", "Bandas", 2, 0, 8),
      f("forward", "Delanteros", 1, 0, 6),
    ],
    weights: [],
  },
  rivalDifficulty: {
    title: "Dificultad del rival",
    description:
      "Ante un rival difícil, a igualdad de justicia salen primero los jugadores de menor nivel. Se calcula con la probabilidad de victoria del pronóstico.",
    defaultText: "Dificultad del rival según el pronóstico",
    points: [
      f("hardBelow", "Rival difícil si la probabilidad de victoria es menor de (%)", 40, 0, 100),
      f("easyAbove", "Rival fácil si la probabilidad de victoria es mayor de (%)", 65, 0, 100),
    ],
    weights: [],
  },
  rating: {
    title: "Nivel ponderado",
    description: "Valoración del jugador combinando competitividad, físico, táctica y técnica. Solo se usa ante un rival difícil.",
    defaultText: "Nivel ponderado (Comp > Fis > Tac > Tec)",
    points: [],
    weights: [
      f("competitiveness", "Peso competitividad (0-1)", 0.45, 0, 1),
      f("physical", "Peso físico (0-1)", 0.25, 0, 1),
      f("tactical", "Peso táctico (0-1)", 0.2, 0, 1),
      f("technical", "Peso técnico (0-1)", 0.1, 0, 1),
    ],
  },
};

export function defaultNumbers(fields: NumberField[]): RuleNumbers {
  return Object.fromEntries(fields.map((field) => [field.key, field.default]));
}

export function buildDefaultRule(condition: RuleCondition): DeconvocationRuleConfig {
  const def = RULE_CATALOG[condition];
  return {
    condition,
    text: def.defaultText,
    points: defaultNumbers(def.points),
    weights: defaultNumbers(def.weights),
  };
}

/**
 * Finds the configured rule for a condition, completing missing points/weights with the defaults.
 * Returns null when the team has no rule for that condition (the rule does not apply).
 */
export function resolveRule(
  condition: RuleCondition,
  rules: DeconvocationRuleConfig[],
): DeconvocationRuleConfig | null {
  const found = rules.find((r) => r.condition === condition);
  if (!found) return null;
  const def = RULE_CATALOG[condition];
  return {
    condition,
    text: found.text?.trim() ? found.text : def.defaultText,
    points: { ...defaultNumbers(def.points), ...found.points },
    weights: { ...defaultNumbers(def.weights), ...found.weights },
  };
}

export function unusedConditions(rules: DeconvocationRuleConfig[]): RuleCondition[] {
  const used = new Set(rules.map((r) => r.condition));
  return RULE_CONDITIONS.filter((c) => !used.has(c));
}

export function fillText(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}
