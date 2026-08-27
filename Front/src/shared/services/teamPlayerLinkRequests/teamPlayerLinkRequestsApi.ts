import { client } from "../../../core/api/client";
import type { TeamPlayerLinkRequestDto } from "../../types/scope";

export type TeamPlayerLinkRequestStatusFilter = "pending" | "decided" | "all";

export class TeamPlayerLinkRequestsApi {
  async list(teamId: string, status: TeamPlayerLinkRequestStatusFilter): Promise<TeamPlayerLinkRequestDto[]> {
    const res = await client.get(`/api/teams/${encodeURIComponent(teamId)}/player-link-requests`, {
      params: { status },
    });
    return res.data as TeamPlayerLinkRequestDto[];
  }

  async approve(requestId: string): Promise<void> {
    await client.post(`/api/team-player-link-requests/${encodeURIComponent(requestId)}/approve`);
  }

  async reject(requestId: string): Promise<void> {
    await client.post(`/api/team-player-link-requests/${encodeURIComponent(requestId)}/reject`);
  }
}

export const teamPlayerLinkRequestsApi = new TeamPlayerLinkRequestsApi();
