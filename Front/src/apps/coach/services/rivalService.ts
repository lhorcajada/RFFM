import client from "../../../core/api/client";

export interface RivalResponse {
  id: string;
  name: string;
  urlPhoto?: string | null;
}

export async function getRivals(): Promise<RivalResponse[]> {
  const resp = await client.get<RivalResponse[]>("/api/rivals");
  return resp.data ?? [];
}

export default { getRivals };
