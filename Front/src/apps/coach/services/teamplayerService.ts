import client from "../../../core/api/client";

export type PlayerResponse = {
  id: string;
  playerId?: string | null;
  seasonId?: string | null;
  name: string;
  lastName?: string | null;
  alias: string;
  urlPhoto?: string | null;
  dorsal?: number | null;
  position?: string | null;
  age?: number | null;
  birthYear?: number | null;
  team?: string | null;
  teamCategory?: string | null;
  isInjured?: boolean;
  injuryStartDate?: string | null;
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

export async function getPlayersByTeam(teamId: string, seasonId?: string): Promise<PlayerResponse[]> {
  if (!teamId) throw new Error("teamId is required");

  // Primary source for Coach app roster: TeamPlayers in catalog DB.
  try {
    const resp = await client.get<PlayerResponse[]>(
      `/api/catalog/team/${encodeURIComponent(teamId)}/players`,
      seasonId ? { params: { seasonId } } : undefined
    );
    return Array.isArray(resp.data) ? resp.data : [];
  } catch {
    // Backward-compatible fallback for environments where catalog route is unavailable.
    const query = seasonId ? `?seasonId=${encodeURIComponent(seasonId)}` : "";
    const resp = await client.get<any>(`teams/${encodeURIComponent(teamId)}${query}`);
    const payload = resp.data as {
      players?: PlayerResponse[];
      jugadores_equipo?: PlayerResponse[];
      jugadores?: PlayerResponse[];
    } | null;

    if (!payload) return [];

    const roster =
      payload.players ??
      payload.jugadores_equipo ??
      payload.jugadores ??
      [];

    return Array.isArray(roster) ? roster : [];
  }
}

export async function addPlayerToTeam(payload: {
  teamId: string;
  clubId: string;
  seasonId: string;
  playerId?: string | null;
  name: string;
  lastName?: string | null;
  alias: string;
  dorsal?: number | null;
  birthDate?: string | null;
  position?: string | null;
  urlPhoto?: string | null;
}): Promise<void> {
  if (!payload.teamId) throw new Error("teamId is required");
  if (!payload.clubId) throw new Error("clubId is required");
  if (!payload.seasonId?.trim()) throw new Error("seasonId is required");
  if (!payload.name?.trim()) throw new Error("name is required");
  if (!payload.alias?.trim()) throw new Error("alias is required");

  const form = new FormData();
  form.append("TeamId", payload.teamId);
  form.append("ClubId", payload.clubId);
  form.append("SeasonId", payload.seasonId.trim());
  form.append("Name", payload.name.trim());
  form.append("Alias", payload.alias.trim());

  if (payload.playerId?.trim()) form.append("PlayerId", payload.playerId.trim());
  if (payload.lastName?.trim()) form.append("LastName", payload.lastName.trim());
  if (payload.dorsal != null) form.append("Dorsal", String(payload.dorsal));
  if (payload.birthDate) form.append("BirthDate", payload.birthDate);
  if (payload.position?.trim()) form.append("Position", payload.position.trim());
  if (payload.urlPhoto?.trim()) form.append("UrlPhoto", payload.urlPhoto.trim());

  await client.post("/api/catalog/team/add-player", form);
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

export async function getTeamPlayerLinkCode(teamPlayerId: string): Promise<{ teamPlayerId: string; linkCode: string }> {
  const res = await client.get(`/api/team-players/${encodeURIComponent(teamPlayerId)}/link-code`);
  return res.data;
}

export async function regenerateTeamPlayerLinkCode(teamPlayerId: string): Promise<{ teamPlayerId: string; linkCode: string }> {
  const res = await client.post(`/api/team-players/${encodeURIComponent(teamPlayerId)}/link-code/regenerate`);
  return res.data;
}

export default { getPlayersByTeam, addPlayerToTeam, getTeamPlayerById, updateTeamPlayer, getPlayerInjuries, createPlayerInjury, updatePlayerInjury, deletePlayerInjury, dischargeActiveInjury, getTeamPlayerLinkCode, regenerateTeamPlayerLinkCode };
