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

export type RffmGroupTeam = {
  teamCode: string;
  teamName: string;
};

export type UpdateTeamCompetitionPayload = {
  competitionId: number | null;
  groupId: number | null;
  teamCode: string | null;
};

export async function getCompetitions(): Promise<RffmCompetition[]> {
  const resp = await client.get<RffmCompetition[]>("competitions");
  return resp.data ?? [];
}

export async function getGroups(competitionId: number): Promise<RffmGroup[]> {
  const resp = await client.get<RffmGroup[]>(`groups?competitionId=${competitionId}`);
  return resp.data ?? [];
}

type ClassificationTeamRow = { teamId?: string | number | null; teamName?: string | null };

// The group's standings already list every team of the group with its RFFM code and name.
export async function getGroupTeams(competitionId: number, groupId: number): Promise<RffmGroupTeam[]> {
  const resp = await client.get<ClassificationTeamRow[] | { teams?: ClassificationTeamRow[] }>("classification", {
    params: { competition: competitionId, group: groupId },
  });
  const rows = Array.isArray(resp.data) ? resp.data : resp.data?.teams ?? [];
  return rows
    .map((row) => ({ teamCode: String(row.teamId ?? "").trim(), teamName: String(row.teamName ?? "").trim() }))
    .filter((team) => team.teamCode !== "")
    .sort((a, b) => a.teamName.localeCompare(b.teamName, "es"));
}

export async function updateTeamCompetition(
  teamId: string,
  payload: UpdateTeamCompetitionPayload
): Promise<void> {
  if (!teamId) throw new Error("teamId is required");
  await client.put(`/api/catalog/team/${encodeURIComponent(teamId)}/competition`, {
    RffmCompetitionId: payload.competitionId,
    RffmGroupId: payload.groupId,
    RffmTeamCode: payload.teamCode,
  });
}

export default {
  getCompetitions,
  getGroups,
  getGroupTeams,
  updateTeamCompetition,
};
