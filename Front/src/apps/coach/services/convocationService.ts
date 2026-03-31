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
  availabilityTypeId?: number | null;
  assistanceTypeId?: number | null;
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
  const resp = await client.get<any[]>(
    `/api/events/${eventId}/convocations`
  );
  const data = resp.data ?? [];
  return data.map((c: any) => ({
    id: c.convocationId ?? c.id,
    player: {
      id: c.teamPlayerId,
      alias: c.alias,
      urlPhoto: c.urlPhoto,
      position: c.position,
    },
    status: c.statusId ?? c.status ?? 1,
    excuseTypeId: c.excuseTypeId,
    availabilityTypeId: c.availabilityTypeId,
    assistanceTypeId: c.assistanceTypeId,
  }));
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
      newStatusId: statusId,
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
