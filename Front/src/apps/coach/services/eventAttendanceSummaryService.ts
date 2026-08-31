import client from "../../../core/api/client";

/**
 * Real `Convocation.ConvocationStatusId` names — the actual convocation
 * workflow (`ConvocationCard.tsx`, `PUT /api/events/{eventId}/convocations/
 * {convocationId}/status`), NOT the Mobile RSVP flow's Going/Pending/
 * NotGoing wording used in an earlier draft of this endpoint.
 */
export type ConvocationStatusName = "Pending" | "Accepted" | "Deconvoke" | "Justified";

export type EventAttendanceSummaryDto = {
  eventId: string;
  convocados: number;
  going: number;
  pending: number;
  notGoing: number;
  attendancePercentage: number;
  /** The caller's own convocation status for this event; `null` when the
   * caller is Coach/Administrator, has no linked player, or their player
   * isn't convoked to this specific event. */
  myStatus: ConvocationStatusName | null;
  myStatusId: number | null;
  /** `Convocation.Id` for the caller's own convocation — required to call
   * `PUT /api/events/{eventId}/convocations/{convocationId}/status`
   * (`convocationService.updateConvocationStatus`) directly. `null` exactly
   * when `myStatus` is `null`. */
  myConvocationId: string | null;
};

export async function getEventAttendanceSummaries(
  teamId: string,
  eventIds: string[]
): Promise<EventAttendanceSummaryDto[]> {
  if (!teamId || eventIds.length === 0) return [];
  const resp = await client.get<EventAttendanceSummaryDto[]>(
    "/api/sport-events/attendance-summary",
    { params: { teamId, eventIds: eventIds.join(",") } }
  );
  return resp.data ?? [];
}

export default { getEventAttendanceSummaries };
