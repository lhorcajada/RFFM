import client from "../../../core/api/client";

export type MatchCategory = "League" | "Friendly" | "Tournament" | null;

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
  // Stable, backend-computed match category — replaces client-side name/id matching
  matchCategory?: MatchCategory;
  location?: string | null;
  locationMapUrl?: string | null;
  // Additional fields that backend may provide
  name?: string | null;
  rival?: string | null;
  rivalId?: string | null;
  arrivalDate?: string | null;
  arrival?: string | null;
  endTime?: string | null;
  teamId?: string | null;
  // Calendar sync fields
  isHomeMatch?: boolean | null;
  codActa?: string | null;
  rivalName?: string | null;
  rivalPhotoUrl?: string | null;
  teamName?: string | null;
  teamPhotoUrl?: string | null;
  localGoals?: string | null;
  visitorGoals?: string | null;
  selectedKitNumber?: number | null;
  hasConvokedPlayers?: boolean | null;
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

export interface SportEventRecurrencePayload {
  frequency: "daily" | "weekly" | "monthly";
  endDate: string; // yyyy-MM-dd
}

export interface NewRivalPayload {
  name: string;
  urlPhoto?: string | null;
  category?: string | null;
}

export interface SportEventPayload {
  name: string;
  eveDateTime?: string | null; // ISO — optional, event can be scheduled later
  startTime?: string | null;
  endTime?: string | null;
  arrivalDate?: string | null;
  location?: string | null;
  locationMapUrl?: string | null;
  description?: string | null;
  eventTypeId: number;
  teamId: string;
  rivalId?: string | null;
  newRival?: NewRivalPayload | null;
  isHomeMatch?: boolean | null;
  codActa?: string | null;
  recurrence?: SportEventRecurrencePayload | null;
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

// ── Calendar Sync ─────────────────────────────────────────────────────────────

export interface SyncMatchItem {
  rivalName: string;
  rivalShieldUrl?: string | null;
  matchDate: string; // ISO date
  matchTime?: string | null;
  field?: string | null;
  isHomeMatch: boolean;
  codActa?: string | null;
  localGoals?: string | null;
  visitorGoals?: string | null;
}

export interface SyncCalendarPayload {
  teamId: string;
  matches: SyncMatchItem[];
  myTeamShieldUrl?: string | null;
  // Optional bulk-upsert arrays — same item shape as `matches`, idempotently
  // upserted as EventTypeId 4 (Friendly) / 6 (Tournament) respectively.
  friendlies?: SyncMatchItem[];
  tournaments?: SyncMatchItem[];
}

export interface SyncCalendarResult {
  created: number;
  updated: number;
  failed: number;
  events: SportEventResponse[];
}

export async function syncCalendarFromFederation(
  payload: SyncCalendarPayload
): Promise<SyncCalendarResult> {
  const resp = await client.post<SyncCalendarResult>("/api/sport-events/sync-calendar", payload);
  return resp.data;
}

export default { getSportEvents, getSportEventById, deleteSportEvent, createSportEvent, updateSportEvent, syncCalendarFromFederation };
