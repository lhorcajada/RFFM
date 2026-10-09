import client from "../../../core/api/client";

export type AvailabilityStatus = "Requested" | "Available" | "Unavailable";

export type AvailabilityRequestItem = {
  id: string;
  teamPlayerId: string;
  status: AvailabilityStatus;
  requestedAt: string;
  respondedAt: string | null;
};

export type RequestAvailabilityResponse = {
  requestedCount: number;
};

export async function getAvailabilityRequests(eventId: string): Promise<AvailabilityRequestItem[]> {
  const resp = await client.get<AvailabilityRequestItem[]>(`/api/events/${eventId}/availability-requests`);
  return resp.data ?? [];
}

export async function requestAvailability(eventId: string): Promise<RequestAvailabilityResponse> {
  const resp = await client.post<RequestAvailabilityResponse>(`/api/events/${eventId}/availability-requests`);
  return resp.data;
}

export async function respondAvailability(
  eventId: string,
  requestId: string,
  available: boolean,
  excuseTypeId?: number | null
): Promise<void> {
  await client.put(`/api/events/${eventId}/availability-requests/${requestId}/response`, {
    available,
    excuseTypeId: excuseTypeId ?? null,
  });
}

export async function decideAvailable(eventId: string, requestId: string, convoke: boolean): Promise<void> {
  await client.post(`/api/events/${eventId}/availability-requests/${requestId}/decision`, { convoke });
}

export default {
  getAvailabilityRequests,
  requestAvailability,
  respondAvailability,
  decideAvailable,
};
