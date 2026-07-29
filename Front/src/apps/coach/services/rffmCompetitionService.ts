import client from "../../../core/api/client";

// Real RFFM competitions catalog (scraped from the federation website), distinct from the
// local Liga/Grupo catalog consumed by LeagueSelect/competitionService.ts.
export type RffmCompetition = {
  id: number;
  name: string;
  categoryGroup: string;
};

export type RffmGroup = {
  id: number;
  name: string;
};

export type UpdateTeamCompetitionPayload = {
  competitionId: number | null;
  groupId: number | null;
};

export async function getCompetitions(): Promise<RffmCompetition[]> {
  const resp = await client.get<RffmCompetition[]>("competitions");
  return resp.data ?? [];
}

export async function getGroups(competitionId: number): Promise<RffmGroup[]> {
  const resp = await client.get<RffmGroup[]>(`groups?competitionId=${competitionId}`);
  return resp.data ?? [];
}

export async function updateTeamCompetition(
  teamId: string,
  payload: UpdateTeamCompetitionPayload
): Promise<void> {
  if (!teamId) throw new Error("teamId is required");
  await client.put(`/api/catalog/team/${encodeURIComponent(teamId)}/competition`, {
    RffmCompetitionId: payload.competitionId,
    RffmGroupId: payload.groupId,
  });
}

export default {
  getCompetitions,
  getGroups,
  updateTeamCompetition,
};
