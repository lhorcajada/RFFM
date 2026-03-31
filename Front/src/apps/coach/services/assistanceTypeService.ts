import client from "../../../core/api/client";

export type AssistanceType = {
  id: number;
  name: string;
  points: number;
};

export async function getAssistanceTypes(): Promise<AssistanceType[]> {
  const resp = await client.get<AssistanceType[]>(
    "/api/catalog/assistancetypes"
  );
  return resp.data ?? [];
}

export async function updateConvocationAssistance(
  eventId: string,
  convocationId: string,
  assistanceTypeId: number | null,
  excuseTypeId?: number | null
): Promise<void> {
  await client.put(
    `/api/events/${eventId}/convocations/${convocationId}/assistance`,
    { assistanceTypeId, excuseTypeId: excuseTypeId ?? null }
  );
}

export default { getAssistanceTypes, updateConvocationAssistance };
