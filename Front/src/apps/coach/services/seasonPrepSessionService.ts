import client from "../../../core/api/client";

export type SeasonPrepSessionData = {
  fedSeason: string;
  slot: object;
  pool: object[];
};

export async function getSeasonPrepSession(): Promise<SeasonPrepSessionData | null> {
  const response = await client.get<{ data: string; updatedAt: string }>(
    "/api/season-prep/session"
  );
  if (response.status === 204 || !response.data?.data) return null;
  try {
    return JSON.parse(response.data.data) as SeasonPrepSessionData;
  } catch {
    return null;
  }
}

export async function upsertSeasonPrepSession(
  state: SeasonPrepSessionData
): Promise<void> {
  await client.put("/api/season-prep/session", { data: JSON.stringify(state) });
}

export async function deleteSeasonPrepSession(): Promise<void> {
  await client.delete("/api/season-prep/session");
}
