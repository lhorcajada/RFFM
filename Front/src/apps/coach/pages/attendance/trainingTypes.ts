export const TRAINING_TYPE_CODES = ["Fisico", "Tecnico", "Tactico"] as const;

export type TrainingTypeCode = (typeof TRAINING_TYPE_CODES)[number];

export const TRAINING_TYPE_LABELS: Record<TrainingTypeCode, string> = {
  Fisico: "Físico",
  Tecnico: "Técnico",
  Tactico: "Táctico",
};
