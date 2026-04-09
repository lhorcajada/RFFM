import client from "../../../core/api/client";

export interface IdealLineupSlot {
  slotIndex: number;
  teamPlayerId: string | null;
}

export interface TeamIdealLineupDto {
  id: string;
  formationId: string;
  slots: IdealLineupSlot[];
}

export interface SaveLineupPayload {
  formationId: string;
  seasonId?: string | null;
  slots: { slotIndex: number; teamPlayerId: string | null }[];
}

export async function getIdealLineup(
  teamId: string,
  seasonId?: string | null
): Promise<TeamIdealLineupDto | null> {
  try {
    const params = seasonId ? `?seasonId=${encodeURIComponent(seasonId)}` : "";
    const resp = await client.get(`/api/catalog/team/${teamId}/ideal-lineup${params}`);
    return resp.data as TeamIdealLineupDto;
  } catch (err: any) {
    if (err?.response?.status === 404) return null;
    throw err;
  }
}

export async function saveIdealLineup(
  teamId: string,
  payload: SaveLineupPayload
): Promise<void> {
  await client.post(`/api/catalog/team/${teamId}/ideal-lineup`, payload);
}

export default { getIdealLineup, saveIdealLineup };
