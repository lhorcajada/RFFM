import client from "../../../core/api/client";

export type SanctionRecord = {
  id: string;
  startDate: string;
  sanctionType: string;
  description?: string | null;
  estimatedEnd?: string | null;
  endDate?: string | null;
};

export async function getPlayerSanctions(teamPlayerId: string): Promise<SanctionRecord[]> {
  try {
    const resp = await client.get<SanctionRecord[]>(
      `/api/catalog/teamplayer/${encodeURIComponent(teamPlayerId)}/sanctions`
    );
    return resp.data ?? [];
  } catch {
    return [];
  }
}

export async function createPlayerSanction(
  teamPlayerId: string,
  payload: { startDate: string; sanctionType: string; description?: string | null; estimatedEnd?: string | null }
): Promise<SanctionRecord | null> {
  try {
    const resp = await client.post<SanctionRecord>(
      `/api/catalog/teamplayer/${encodeURIComponent(teamPlayerId)}/sanctions`,
      payload
    );
    return resp.data ?? null;
  } catch {
    return null;
  }
}

export async function updatePlayerSanction(
  teamPlayerId: string,
  sanctionId: string,
  payload: { startDate: string; sanctionType: string; description?: string | null; estimatedEnd?: string | null; endDate?: string | null }
): Promise<SanctionRecord | null> {
  try {
    const resp = await client.put<SanctionRecord>(
      `/api/catalog/teamplayer/${encodeURIComponent(teamPlayerId)}/sanctions/${encodeURIComponent(sanctionId)}`,
      payload
    );
    return resp.data ?? null;
  } catch {
    return null;
  }
}

export async function deletePlayerSanction(teamPlayerId: string, sanctionId: string): Promise<boolean> {
  try {
    await client.delete(
      `/api/catalog/teamplayer/${encodeURIComponent(teamPlayerId)}/sanctions/${encodeURIComponent(sanctionId)}`
    );
    return true;
  } catch {
    return false;
  }
}

export type TeamPlayerSanctions = { teamPlayerId: string; sanctions: SanctionRecord[] };

export async function getTeamSanctions(teamId: string): Promise<TeamPlayerSanctions[]> {
  try {
    const resp = await client.get<{ teamPlayerId: string; sanctions: SanctionRecord[] }[]>(
      `/api/catalog/team/${encodeURIComponent(teamId)}/sanctions`
    );
    return resp.data ?? [];
  } catch {
    return [];
  }
}

export default { getPlayerSanctions, createPlayerSanction, updatePlayerSanction, deletePlayerSanction, getTeamSanctions };
