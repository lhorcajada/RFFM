import type { RawPlayer } from "./rawPlayer";

export interface RawTeam {
  // english or spanish variants
  players?: RawPlayer[];
  jugadores_equipo?: RawPlayer[];
  jugadores?: RawPlayer[];
  delegates?: any[];
  delegados_equipo?: any[];
  delegados?: any[];
  assistants?: any[];
  auxiliares_equipo?: any[];
  auxiliares?: any[];
  coaches?: any[];
  tecnicos_equipo?: any[];
  tecnicos?: any[];
  [key: string]: unknown;
}
