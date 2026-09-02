import { client } from "../../core/api/client";

export type RffmSeasonOption = {
  id: number;
  label: string;
};

export type RffmSeasonsResponse = {
  currentSeasonId: number;
  preferredSeasonId: number | null;
  seasons: RffmSeasonOption[];
};

export async function getRffmSeasons(): Promise<RffmSeasonsResponse> {
  const res = await client.get("rffm/seasons");
  return res.data as RffmSeasonsResponse;
}

export async function saveRffmSeasonPreference(seasonId: number): Promise<void> {
  await client.put("rffm/season-preference", { seasonId });
}
