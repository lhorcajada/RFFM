import client from "../../../core/api/client";

export type PlayerSimple = {
  id?: string;
  alias?: string;
  urlPhoto?: string | null;
  position?: string;
  isInjured?: boolean;
  injuryStartDate?: string | null;
};

export type ConvocationItem = {
  id: string;
  player: PlayerSimple;
  status: number; // convocation status id
  excuseTypeId?: number | null;
  availabilityTypeId?: number | null;
  assistanceTypeId?: number | null;
  isInjured?: boolean;
};

export async function getEventPlayers(
  eventId: string
): Promise<PlayerSimple[]> {
  const resp = await client.get<any[]>(
    `/api/events/${eventId}/players`
  );
  const data = resp.data ?? [];
  return data.map((p: any) => ({
    id: p.teamPlayerId ?? p.id,
    alias: p.alias,
    urlPhoto: p.urlPhoto ?? null,
    position: p.position,
    isInjured: p.isInjured ?? false,
    injuryStartDate: p.injuryStartDate ?? null,
  }));
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
    isInjured: c.isInjured ?? false,
  }));
}

export async function addConvocation(
  eventId: string,
  teamPlayerId: string
): Promise<ConvocationItem> {
  const resp = await client.post<ConvocationItem>(
    `/api/events/${eventId}/convocations`,
    { teamPlayerId }
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
