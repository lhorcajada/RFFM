import client from "../../../core/api/client";

export type FamilyRecipient = {
  familyMemberId: string;
  name: string | null;
  lastName: string | null;
  phone: string;
  familyMember: string | null;
};

export type PlayerRecipients = {
  teamPlayerId: string;
  playerAlias: string;
  familyMembers: FamilyRecipient[];
};

export async function getConvocationNotificationRecipients(
  eventId: string,
  teamPlayerIds: string[]
): Promise<PlayerRecipients[]> {
  const qs = new URLSearchParams();
  teamPlayerIds.forEach((id) => qs.append("teamPlayerIds", id));
  const resp = await client.get<{ players: PlayerRecipients[] }>(
    `/api/events/${eventId}/convocations/notification-recipients?${qs.toString()}`
  );
  return resp.data?.players ?? [];
}

export default { getConvocationNotificationRecipients };
