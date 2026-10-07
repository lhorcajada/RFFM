import type { SquadPlayer } from "../../squad/components/IdealLineup";
import { useMatchSquad } from "./useMatchSquad";

/** Jugadores disponibles para el partido en directo, con los mismos datos que en la
 *  ficha del partido (fotos, competitividad, rodaje, jornadas sin decisión técnica). */
export function useLiveMatchLineupPlayers(
  teamId: string,
  matchDate: string | undefined,
): { lineupPlayers: SquadPlayer[] } {
  const { lineupPlayers } = useMatchSquad(teamId, matchDate);
  return { lineupPlayers };
}
