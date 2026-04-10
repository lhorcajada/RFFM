import client from "../../../core/api/client";

export interface SportEventResponse {
  id: string;
  title: string;
  description?: string | null;
  // Some responses use `startTime` or `eveDateTime`; keep `start` for compatibility
  start?: string; // ISO date
  startTime?: string | null; // ISO date/time
  eveDateTime?: string | null; // ISO date/time
  end?: string | null; // ISO date
  eventType?: string | null;
  eventTypeId?: number | null;
  location?: string | null;
  // Additional fields that backend may provide
  name?: string | null;
  rival?: string | null;
  rivalId?: string | null;
  arrivalDate?: string | null;
  arrival?: string | null;
  endTime?: string | null;
  teamId?: string | null;
}

export interface PagedSportEvents {
  items: SportEventResponse[];
  pageNumber: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export async function getSportEvents(
  teamId: string,
  pageNumber = 1,
  pageSize = 10,
  startDate?: string | null,
  endDate?: string | null,
  descending = false
): Promise<PagedSportEvents> {
  const params: Record<string, any> = { pageNumber, pageSize, descending };
  if (startDate) params.startDate = startDate;
  // Append T23:59:59 so the backend includes events that fall anywhere on the last day
  if (endDate) params.endDate = endDate.includes("T") ? endDate : `${endDate}T23:59:59`;

  const resp = await client.get(`/api/sport-events/${teamId}`, { params });
  const data = resp.data ?? [];
  // If backend returns a paged payload, use it directly
  if (data && (data as any).items) return data as PagedSportEvents;

  // If backend returns an array (current implementation), try to resolve total count from headers
  const items = Array.isArray(data) ? data : [];
  let totalItems = items.length;
  let totalPages = 1;

  const headerTotal =
    resp.headers?.["x-total-count"] ?? resp.headers?.["X-Total-Count"];
  if (headerTotal) {
    const parsed = Number(headerTotal);
    if (!isNaN(parsed) && parsed > 0) {
      totalItems = parsed;
      totalPages = Math.max(1, Math.ceil(parsed / pageSize));
    }
  } else {
    // Fallback: if returned items match pageSize, there may be a next page
    if (items.length >= pageSize) {
      totalPages = pageNumber + 1; // allow navigating to next page; will expand as user navigates
    } else {
      totalPages = pageNumber;
    }
  }

  return {
    items,
    pageNumber,
    pageSize,
    totalItems,
    totalPages,
  };
}

export async function getSportEventById(
  id: string
): Promise<SportEventResponse | null> {
  try {
    const resp = await client.get(`/api/sport-events/item/${id}`);
    return resp.data ?? null;
  } catch (e) {
    return null;
  }
}

export async function deleteSportEvent(id: string): Promise<void> {
  await client.delete(`/api/sport-events/${id}`);
}

export interface SportEventPayload {
  name: string;
  eveDateTime: string; // ISO
  startTime?: string | null;
  endTime?: string | null;
  arrivalDate?: string | null;
  location?: string | null;
  description?: string | null;
  eventTypeId: number;
  teamId: string;
  rivalId?: string | null;
}

export async function createSportEvent(
  payload: SportEventPayload
): Promise<SportEventResponse> {
  const resp = await client.post<SportEventResponse>("/api/sport-events", payload);
  return resp.data;
}

export async function updateSportEvent(
  id: string,
  payload: Omit<SportEventPayload, "teamId">
): Promise<SportEventResponse> {
  const resp = await client.put<SportEventResponse>(`/api/sport-events/${id}`, payload);
  return resp.data;
}

export default { getSportEvents, getSportEventById, deleteSportEvent, createSportEvent, updateSportEvent };
