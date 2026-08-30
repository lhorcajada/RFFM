import client from "../../../core/api/client";
import type { MembershipKind } from "../../../shared/types/scope";

export type TeamUserDto = {
  membershipId: string;
  userId: string;
  alias: string;
  email: string;
  membershipKind: MembershipKind;
  joinedAt: string | null;
  isCreator: boolean;
  isSelf: boolean;
  isApproved: boolean;
  linkedPlayerFullName: string | null;
};

export type GetTeamUsersResponse = {
  teamId: string;
  teamName: string;
  callerIsCreator: boolean;
  users: TeamUserDto[];
};

const getTeamUsers = async (teamId: string): Promise<GetTeamUsersResponse> => {
  const { data } = await client.get<GetTeamUsersResponse>("/api/coaches/team-users", {
    params: { teamId },
  });
  return data;
};

const deleteTeamUserAccount = async (membershipId: string): Promise<void> => {
  await client.delete(`/api/coaches/team-users/${encodeURIComponent(membershipId)}`);
};

const setTeamUserApproval = async (
  membershipId: string,
  approved: boolean
): Promise<void> => {
  await client.put(
    `/api/coaches/team-users/${encodeURIComponent(membershipId)}/approval`,
    { approved }
  );
};

export default {
  getTeamUsers,
  deleteTeamUserAccount,
  setTeamUserApproval,
};
