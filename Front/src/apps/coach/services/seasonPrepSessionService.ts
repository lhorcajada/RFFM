import client from "../../../core/api/client";

export type SeasonPrepSessionData = {
  fedSeason: string;
  sportEventId?: string | null;
  slot: object;
  pool: object[];
};

export async function getSeasonPrepSession(sportEventId?: string | null): Promise<SeasonPrepSessionData | null> {
  const params = sportEventId ? { sportEventId } : undefined;
  const response = await client.get<{ data: string; updatedAt: string }>(
    "/api/season-prep/session",
    { params }
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
  await client.put("/api/season-prep/session", {
    data: JSON.stringify(state),
    sportEventId: state.sportEventId ?? null,
  });
}

export async function deleteSeasonPrepSession(sportEventId?: string | null): Promise<void> {
  await client.delete("/api/season-prep/session", {
    params: sportEventId ? { sportEventId } : undefined,
  });
}
