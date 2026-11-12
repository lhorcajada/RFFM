export const RULE_CONDITIONS = [
  "goals",
  "streak",
  "minimum",
  "rivalResult",
  "injured",
  "weeklyTraining",
  "recentRecovery",
  "recentDeconvocation",
  "technicalTotal",
  "rating",
  "necessity",
  "weeklyTrainingAccum",
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

const streakTable = [50, 45, 20, 15, 10, 5, 3].map((v, i) => f(`j${i + 1}`, `Racha de ${i + 1} jornada${i ? "s" : ""}`, v));

export const RULE_CATALOG: Record<RuleCondition, ConditionDefinition> = {
  goals: {
    title: "Goles de liga",
    description: "Protege a quien marca goles en la temporada.",
    defaultText: "Goles (liga)",
    points: [f("perGoal", "Puntos por gol", 2)],
    weights: [],
  },
  streak: {
    title: "Jornadas sin desconvocatoria técnica",
    description: "Protege más a quien lleva pocas jornadas seguidas convocado sin decisión técnica.",
    defaultText: "Jornadas sin desconvocatoria técnica",
    points: streakTable,
    weights: [
      f("offset", "Base sin racha", 8.5),
      f("slope", "Descenso por jornada", 0.6),
      f("scale", "Escala", 1),
      f("positiveCap", "Tope positivo", 40),
      f("negativeCap", "Tope negativo", 15),
      f("lowBonus", "Bonus racha 0 o 1", 22),
      f("recentTechBoost", "Bonus por desconvocatoria técnica reciente", 6),
    ],
  },
  minimum: {
    title: "Mínimo de convocatorias",
    description: "Protege a quien no llega al mínimo de convocatorias exigido.",
    defaultText: "Le faltan {deficit} convocatorias para llegar al mínimo exigido ({min})",
    placeholders: ["{deficit}", "{min}"],
    points: [f("perMissingCall", "Puntos por convocatoria que falta", 4.5)],
    weights: [f("cap", "Tope de puntos", 24)],
  },
  rivalResult: {
    title: "Resultado contra el rival",
    description: "Según el último resultado contra el rival, protege a los más necesarios o descansa titulares.",
    defaultText: "{result} vs {rival} ({score})",
    placeholders: ["{result}", "{rival}", "{score}"],
    points: [f("loss", "Base tras derrota", 22), f("draw", "Base tras empate", 14), f("win", "Base tras victoria", 8)],
    weights: [f("bigWinGoalDiff", "Diferencia de goles para resultado abultado", 7, 1, 50)],
  },
  injured: {
    title: "Lesionado",
    description: "Desconvocatoria automática de los lesionados.",
    defaultText: "Lesionado: desconvocatoria automática",
    mandatory: true,
    points: [f("value", "Puntos", -120)],
    weights: [],
  },
  weeklyTraining: {
    title: "Asistencia a entrenamientos de la semana",
    description: "Puntúa la asistencia semanal; sin asistir a ningún entrenamiento fuerza la desconvocatoria.",
    defaultText: "Puntos por asistencia a entrenamientos y amistosos",
    mandatory: true,
    points: [f("maxAttendance", "Puntos máximos por asistencia", 12), f("forced", "Puntos si no asiste en toda la semana", -100)],
    weights: [
      f("reliableAttendance", "Asistencia de temporada que evita forzar (0-1)", 0.8, 0, 1),
      f("penaltyHalf", "Penalización por imprevisto o problema familiar (0-1)", 0.5, 0, 1),
      f("penaltyThreeQuarters", "Penalización por estudios, enfermedad o cita médica (0-1)", 0.75, 0, 1),
    ],
  },
  recentRecovery: {
    title: "Recuperación reciente de lesión",
    description: "Desconvoca a quien acaba de recibir el alta; protege si ya se perdió el partido anterior.",
    defaultText: "En recuperación de lesión",
    mandatory: true,
    points: [f("forced", "Puntos de desconvocatoria", -100), f("returnProtection", "Protección al volver de una lesión corta", 30)],
    weights: [],
  },
  recentDeconvocation: {
    title: "Desconvocado en las últimas jornadas",
    description: "Protege a quien fue desconvocado hace poco.",
    defaultText: "Desconvocado en las últimas jornadas",
    points: [f("j1", "Hace 1 jornada", 15), f("j2", "Hace 2 jornadas", 10), f("j3", "Hace 3 jornadas", 5)],
    weights: [],
  },
  technicalTotal: {
    title: "Desconvocatorias técnicas acumuladas",
    description: "Protege más a quien acumula más desconvocatorias técnicas.",
    defaultText: "Desconvocatorias técnicas acumuladas",
    points: [f("multiplier", "Puntos máximos", 40)],
    weights: [],
  },
  rating: {
    title: "Nivel ponderado",
    description: "Valoración del jugador combinando competitividad, físico, táctica y técnica.",
    defaultText: "Nivel ponderado (Comp > Fis > Tac > Tec)",
    points: [f("max", "Puntos máximos", 100)],
    weights: [
      f("blockWeight", "Peso del bloque (0-1)", 0.45, 0, 1),
      f("competitiveness", "Peso competitividad (0-1)", 0.45, 0, 1),
      f("physical", "Peso físico (0-1)", 0.25, 0, 1),
      f("tactical", "Peso táctico (0-1)", 0.2, 0, 1),
      f("technical", "Peso técnico (0-1)", 0.1, 0, 1),
    ],
  },
  necessity: {
    title: "Necesidad para el equipo",
    description: "Basada únicamente en la competitividad del jugador.",
    defaultText: "Necesidad para el equipo: basada únicamente en competitividad",
    points: [f("max", "Puntos máximos", 100)],
    weights: [f("blockWeight", "Peso del bloque (0-1)", 0.45, 0, 1)],
  },
  weeklyTrainingAccum: {
    title: "Asistencia de temporada",
    description: "Porcentaje de asistencia a entrenamientos y amistosos durante la temporada.",
    defaultText: "Asistencia a entrenamientos y amistosos (temporada)",
    points: [f("max", "Puntos máximos", 25)],
    weights: [],
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
