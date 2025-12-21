import client from "../../../core/api/client";

export type PlayerResponse = {
  id: string;
  name: string;
  lastName?: string | null;
  alias: string;
  urlPhoto?: string | null;
  dorsal?: number | null;
  position?: string | null;
};

export type AddressResponse = {
  street?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  country?: string | null;
};

export type ContactInfoResponse = {
  address?: AddressResponse | null;
  phone?: string | null;
  email?: string | null;
};

export type PhysicalInfoResponse = {
  height?: number | null;
  weight?: number | null;
  dominantFoot?: string | null;
};

export type DemarcationResponse = {
  activePositionId?: number | null;
  activePositionName?: string | null;
  possibleDemarcations?: string[];
};

export type FamilyResponse = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  familyMember?: string | null;
};

export type TeamPlayerResponse = {
  id: string;
  playerId: string;
  player: any;
  teamId: string;
  joinedDate: string;
  leftDate?: string | null;
  dorsal?: number | null;
  demarcation?: DemarcationResponse | null;
  contactInfo?: ContactInfoResponse | null;
  physicalInfo?: PhysicalInfoResponse | null;
  familyMembers?: FamilyResponse[];
};

export async function getPlayersByTeam(
  teamId: string
): Promise<PlayerResponse[]> {
  if (!teamId) throw new Error("teamId is required");
  const resp = await client.get<PlayerResponse[]>(
    `/api/catalog/team/${encodeURIComponent(teamId)}/players`
  );
  return resp.data ?? [];
}

export async function getTeamPlayerById(
  id: string
): Promise<TeamPlayerResponse | null> {
  if (!id) return null;
  try {
    const resp = await client.get<TeamPlayerResponse>(
      `/api/catalog/teamplayer/${encodeURIComponent(id)}`
    );
    return resp.data ?? null;
  } catch (e) {
    return null;
  }
}

export async function updateTeamPlayer(
  id: string,
  payload: Partial<{
    dorsal?: number | null;
    demarcation?: DemarcationResponse | null;
    contactInfo?: ContactInfoResponse | null;
    physicalInfo?: PhysicalInfoResponse | null;
    familyMembers?: FamilyResponse[];
    playerInfo?: Partial<{
      name?: string | null;
      lastName?: string | null;
      alias?: string | null;
      urlPhoto?: string | null;
    }>;
  }>
): Promise<TeamPlayerResponse | null> {
  if (!id) return null;
  try {
    const resp = await client.put<TeamPlayerResponse>(
      `/api/catalog/teamplayer/${encodeURIComponent(id)}`,
      payload
    );
    return resp.data ?? null;
  } catch (e) {
    return null;
  }
}

export default { getPlayersByTeam, getTeamPlayerById, updateTeamPlayer };
