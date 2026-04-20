import client from "../../../core/api/client";

export interface ClubKit {
  kitNumber: 1 | 2;
  shirtColor: string;
  shortsColor: string;
  socksColor: string;
}

export async function getTeamKits(teamId: string): Promise<ClubKit[]> {
  const resp = await client.get<ClubKit[]>(`/api/teams/${encodeURIComponent(teamId)}/kits`);
  return resp.data;
}

export async function updateEventKit(eventId: string, selectedKitNumber: number | null): Promise<void> {
  await client.patch(`/api/events/${encodeURIComponent(eventId)}/kit`, { selectedKitNumber });
}
