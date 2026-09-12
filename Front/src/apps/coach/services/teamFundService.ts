import client from "../../../core/api/client";

export type TeamFundMovement = {
  id: string;
  amount: number;
  source: string;
  sourceSanctionId?: string | null;
  occurredAt: string;
  description?: string | null;
};

export type TeamFundResponse = {
  teamId: string;
  balance: number;
  movements: TeamFundMovement[];
};

export async function getTeamFund(teamId: string): Promise<TeamFundResponse | null> {
  try {
    const resp = await client.get<TeamFundResponse>(
      `/api/catalog/team/${encodeURIComponent(teamId)}/fund`
    );
    return resp.data ?? null;
  } catch {
    return null;
  }
}

export default { getTeamFund };
