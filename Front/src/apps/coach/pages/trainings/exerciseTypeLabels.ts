import type { ExerciseSection, ExerciseType } from "../../types/training";

export const TYPE_LABELS: Record<ExerciseType, string> = {
  Physical: "Físico",
  Technical: "Técnico",
  Tactical: "Táctico",
  Game: "Juego",
  Cognitive: "Cognitivo",
  Psychological: "Psicológico",
};

export const SECTION_LABELS: Record<ExerciseSection, string> = {
  Calentamiento: "Calentamiento",
  Principal: "Principal",
  VueltaALaCalma: "Vuelta calma",
};
