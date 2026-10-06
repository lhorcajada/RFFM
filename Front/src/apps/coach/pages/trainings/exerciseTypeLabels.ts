import type { ExerciseSubtipo, ExerciseTipo } from "../../types/training";

export const TIPO_LABELS: Record<ExerciseTipo, string> = {
  Analitico: "Analítico",
  Situacional: "Situacional",
  Global: "Global",
};

export const SUBTIPO_LABELS: Record<ExerciseSubtipo, string> = {
  RuedasDePase: "Ruedas de pase",
  Rondos: "Rondos",
  AtaqueOrganizado: "Ataque organizado",
  DefensaOrganizada: "Defensa organizada",
  TransicionDefensaAtaque: "Transición defensa-ataque",
  TransicionAtaqueDefensa: "Transición ataque-defensa",
  Abp: "ABP",
  Posesion: "Posesión",
  Mantenimiento: "Mantenimiento",
  JuegosLudicos: "Juegos lúdicos",
  Circuito: "Circuito",
  JuegoDePosicion: "Juego de posición",
  PartidoCondicionado: "Partido condicionado",
  Partido: "Partido",
};
