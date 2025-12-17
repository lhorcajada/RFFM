import client from "../../../core/api/client";

export type TeamResponse = {
  id: string;
  name: string;
  category: { id: number; name: string };
  league: { id?: number | null; name?: string | null; group?: number | null };
  club: {
    id: string;
    name: string;
    country: { id: number; name: string; code: string };
    shieldUrl?: string | null;
  };
  urlPhoto?: string | null;
};

export async function getTeams(clubId: string): Promise<TeamResponse[]> {
  if (!clubId) throw new Error("clubId is required");
  const resp = await client.get<TeamResponse[]>(`/api/catalog/teams`, {
    params: { clubId },
  } as any);
  return resp.data ?? [];
}

export default { getTeams };
