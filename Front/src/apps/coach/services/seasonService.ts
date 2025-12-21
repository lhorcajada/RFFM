import client from "../../../core/api/client";

export type Season = {
  id: string;
  name?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  active?: boolean | null;
};

export async function getActiveSeason(): Promise<Season | null> {
  try {
    const resp = await client.get<Season>(`/api/catalog/season/active` as any);
    return resp.data ?? null;
  } catch (e) {
    return null;
  }
}

export async function getSeasons(): Promise<Season[]> {
  try {
    const resp = await client.get<Season[]>(`/api/catalog/seasons` as any);
    return resp.data ?? [];
  } catch (e) {
    return [];
  }
}

export default { getActiveSeason, getSeasons };
