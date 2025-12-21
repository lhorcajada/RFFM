import client from "../../../core/api/client";

export interface SportEventType {
  id: number;
  name: string;
}

export async function getSportEventTypes(): Promise<SportEventType[]> {
  const resp = await client.get<SportEventType[]>("/api/sport-event-types");
  return resp.data ?? [];
}

export default { getSportEventTypes };
