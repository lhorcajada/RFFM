import client from "../../../core/api/client";

export type PlayerResponse = {
  id: string;
  name: string;
  lastName?: string | null;
  alias: string;
  urlPhoto?: string | null;
  dorsal?: number | null;
  position?: string | null;
  isInjured?: boolean;
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

export type InjuryRecord = {
  id: string;
  startDate: string;
  injuryType: string;
  description?: string | null;
  estimatedRecovery?: string | null;
  endDate?: string | null;
};

export type InjuryInfoResponse = InjuryRecord;

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
  injuryInfo?: InjuryInfoResponse | null;
};

export async function getPlayersByTeam(
  teamId: string,
  seasonId?: string
): Promise<PlayerResponse[]> {
  if (!teamId) throw new Error("teamId is required");
  const params: any = {};
  if (seasonId) params.seasonId = seasonId;
  const resp = await client.get<PlayerResponse[]>(
    `/api/catalog/team/${encodeURIComponent(teamId)}/players`,
    { params } as any
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

export async function getPlayerInjuries(teamPlayerId: string): Promise<InjuryRecord[]> {
  try {
    const resp = await client.get<InjuryRecord[]>(
      `/api/catalog/teamplayer/${encodeURIComponent(teamPlayerId)}/injuries`
    );
    return resp.data ?? [];
  } catch {
    return [];
  }
}

export async function createPlayerInjury(
  teamPlayerId: string,
  payload: { startDate: string; injuryType: string; description?: string | null; estimatedRecovery?: string | null }
): Promise<InjuryRecord | null> {
  try {
    const resp = await client.post<InjuryRecord>(
      `/api/catalog/teamplayer/${encodeURIComponent(teamPlayerId)}/injuries`,
      payload
    );
    return resp.data ?? null;
  } catch {
    return null;
  }
}

export async function updatePlayerInjury(
  teamPlayerId: string,
  injuryId: string,
  payload: { startDate: string; injuryType: string; description?: string | null; estimatedRecovery?: string | null; endDate?: string | null }
): Promise<InjuryRecord | null> {
  try {
    const resp = await client.put<InjuryRecord>(
      `/api/catalog/teamplayer/${encodeURIComponent(teamPlayerId)}/injuries/${encodeURIComponent(injuryId)}`,
      payload
    );
    return resp.data ?? null;
  } catch {
    return null;
  }
}

export async function deletePlayerInjury(teamPlayerId: string, injuryId: string): Promise<boolean> {
  try {
    await client.delete(
      `/api/catalog/teamplayer/${encodeURIComponent(teamPlayerId)}/injuries/${encodeURIComponent(injuryId)}`
    );
    return true;
  } catch {
    return false;
  }
}

export async function dischargeActiveInjury(teamPlayerId: string): Promise<boolean> {
  const injuries = await getPlayerInjuries(teamPlayerId);
  const active = injuries.find((i) => !i.endDate);
  if (!active) return false;
  const result = await updatePlayerInjury(teamPlayerId, active.id, {
    startDate: active.startDate,
    injuryType: active.injuryType,
    description: active.description,
    estimatedRecovery: active.estimatedRecovery,
    endDate: new Date().toISOString(),
  });
  return result != null;
}

export default { getPlayersByTeam, getTeamPlayerById, updateTeamPlayer, getPlayerInjuries, createPlayerInjury, updatePlayerInjury, deletePlayerInjury, dischargeActiveInjury };
