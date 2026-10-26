import client from "../../../core/api/client";

export type LeaguePlayerStats = {
  teamPlayerId: string;
  goals: number;
  callUps: number;
  starts: number;
  yellowCards: number;
  redCards: number;
  minutesPlayed: number;
};

/** Estadísticas por jugador contando solo partidos de liga; ante un error devuelve una lista vacía. */
export async function getTeamLeagueStats(teamId: string): Promise<LeaguePlayerStats[]> {
  try {
    const resp = await client.get(`/api/catalog/team/${teamId}/league-stats`);
    return (resp.data ?? []) as LeaguePlayerStats[];
  } catch {
    return [];
  }
}

export default { getTeamLeagueStats };
