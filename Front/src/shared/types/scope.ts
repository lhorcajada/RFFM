export type MembershipKind =
  | "Coach" | "Directive" | "ClubMember"
  | "Player" | "FamilyPlayer" | "Follower";

export interface ScopeMember {
  membershipId: string;
  userId: string;
  alias: string;
  email: string;
  membershipKind: MembershipKind;
  joinedAt: string;
  isCreator: boolean;
}

export interface ActiveScope {
  kind: "club" | "team";
  id: string;
  name: string;
}

export interface ScopeInvitation {
  scopeKind: "club" | "team";
  scopeId: string;
  code: string;
}

export interface RegisterPayingAccountPayload {
  alias: string;
  email: string;
  password: string;
  accountType: "Coach" | "Directive";
}

export interface ValidateCodePayload {
  code: string;
  membershipKind: Exclude<MembershipKind, "Coach" | "Directive">;
}

export interface ValidateClubCodeResponse {
  clubId: string;
  clubName: string;
  membershipKind: MembershipKind;
  token?: string;
}

export interface ValidateTeamCodeResponse {
  teamId: string;
  teamName: string;
  clubId: string;
  membershipKind: MembershipKind;
  token?: string;
}

export interface ListScopeMembersParams {
  clubId?: string;
  teamId?: string;
}

export interface RegenerateInvitationPayload {
  scopeKind: "club" | "team";
  scopeId: string;
}

export interface RegenerateInvitationResponse {
  scopeKind: "club" | "team";
  scopeId: string;
  newCode: string;
}

export interface LeaveScopeResponse {
  leftScope: ActiveScope;
}

export interface RegisterPayingAccountResponse {
  userId: string;
  roles: string[];
  subscription: { plan: string; status: string; endDate: string };
}

export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  message?: string;
}
