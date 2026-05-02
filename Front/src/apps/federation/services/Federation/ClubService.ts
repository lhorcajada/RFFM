import { client } from "../../../../core/api/client";

export interface ClubDirectoryItem {
  clubCode: string;
  name: string;
  teamsCount: number;
}

export interface ClubTeam {
  teamCode: string;
  teamName: string;
  categoryDescription: string;
  inCompetition: boolean;
  competitionId: number | null;
  competitionName: string | null;
}

export interface TeamGroupInfo {
  teamCode: string;
  teamName: string;
  groupCode: string;
  groupName: string;
  competitionCode: string;
  competitionName: string;
}

export class ClubService {
  async searchClubs(search: string, codclub?: string): Promise<ClubDirectoryItem[]> {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (codclub) params.codclub = codclub;
    const res = await client.get("clubs/search", { params });
    return res.data as ClubDirectoryItem[];
  }

  async getClubTeams(clubCode: string): Promise<ClubTeam[]> {
    const res = await client.get(`clubs/${encodeURIComponent(clubCode)}/teams`);
    return res.data as ClubTeam[];
  }

  async resolveTeamGroup(clubCode: string, teamCode: string, competitionId?: number | null): Promise<TeamGroupInfo> {
    const params: Record<string, string> = {};
    if (competitionId != null) params.competitionId = String(competitionId);
    const res = await client.get(
      `clubs/${encodeURIComponent(clubCode)}/teams/${encodeURIComponent(teamCode)}/resolve-group`,
      { params },
    );
    return res.data as TeamGroupInfo;
  }
}

export const clubService = new ClubService();
