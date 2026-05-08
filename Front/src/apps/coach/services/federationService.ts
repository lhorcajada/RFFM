import type { Goleador } from "../../federation/types/goleador";
import { getGoleadores } from "../../federation/services/api";

/**
 * Returns the list of goleadores for the given competition/group filtered
 * to only entries that belong to `teamId`.
 */
export async function getTeamGoleadores(
  competitionId: string,
  groupId: string,
  teamId: string,
): Promise<Goleador[]> {
  try {
    const all = await getGoleadores(competitionId, groupId);
    if (!Array.isArray(all)) return [];
    return all.filter((g) => String(g.teamId) === String(teamId));
  } catch (e) {
    return [];
  }
}

export default { getTeamGoleadores };
