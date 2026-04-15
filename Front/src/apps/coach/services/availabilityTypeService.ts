import client from "../../../core/api/client";

export type AvailabilityType = {
  id: number;
  name: string;
};

export async function getAvailabilityTypes(): Promise<AvailabilityType[]> {
  const resp = await client.get<AvailabilityType[]>(
    "/api/catalog/availabilitytypes"
  );
  return resp.data ?? [];
}

export async function updateConvocationAvailability(
  eventId: string,
  convocationId: string,
  availabilityTypeId: number | null,
  excuseTypeId?: number | null
): Promise<void> {
  await client.put(
    `/api/events/${eventId}/convocations/${convocationId}/availability`,
    { availabilityTypeId, excuseTypeId: excuseTypeId ?? null }
  );
}

export default { getAvailabilityTypes, updateConvocationAvailability };
