import client from "../../../core/api/client";

export type PlayerSimple = {
  id?: string;
  alias?: string;
  urlPhoto?: string | null;
  position?: string;
};

export type ConvocationItem = {
  id: string;
  player: PlayerSimple;
  status: number; // convocation status id
  excuseTypeId?: number | null;
};

export async function getEventPlayers(
  eventId: string
): Promise<PlayerSimple[]> {
  const resp = await client.get<PlayerSimple[]>(
    `/api/events/${eventId}/players`
  );
  return resp.data ?? [];
}

export async function getConvocations(
  eventId: string
): Promise<ConvocationItem[]> {
  const resp = await client.get<ConvocationItem[]>(
    `/api/events/${eventId}/convocations`
  );
  return resp.data ?? [];
}

export async function addConvocation(
  eventId: string,
  playerId: string
): Promise<ConvocationItem> {
  const resp = await client.post<ConvocationItem>(
    `/api/events/${eventId}/convocations`,
    { playerId }
  );
  return resp.data;
}

export async function addConvocationsBulk(eventId: string): Promise<void> {
  await client.post(`/api/events/${eventId}/convocations/bulk`);
}

export async function updateConvocationStatus(
  eventId: string,
  convocationId: string,
  statusId: number,
  excuseTypeId?: number | null
): Promise<void> {
  await client.put(
    `/api/events/${eventId}/convocations/${convocationId}/status`,
    {
      statusId,
      excuseTypeId: excuseTypeId ?? null,
    }
  );
}

export async function deleteConvocation(
  eventId: string,
  convocationId: string
): Promise<void> {
  await client.delete(`/api/events/${eventId}/convocations/${convocationId}`);
}

export default {
  getEventPlayers,
  getConvocations,
  addConvocation,
  addConvocationsBulk,
  updateConvocationStatus,
  deleteConvocation,
};
