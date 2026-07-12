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
  accountType: string;
  trialAccepted?: boolean;
  clubInvitationCode?: string;
  teamInvitationCode?: string;
  teamPlayerId?: string;
}

export interface ValidateCodePayload {
  code: string;
  membershipKind: string;
}

export interface TeamRosterPlayer {
  teamPlayerId: string;
  playerId: string;
  name: string;
  lastName: string | null;
  urlPhoto: string | null;
  dorsal: number | null;
  alreadyLinked: boolean;
}

export interface PreviewClubCodeResponse {
  clubId: string;
  clubName: string;
  membershipKind: MembershipKind;
}

export interface PreviewTeamCodeResponse {
  teamId: string;
  teamName: string;
  clubId: string;
  membershipKind: MembershipKind;
  players: TeamRosterPlayer[];
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
  players?: TeamRosterPlayer[];
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

export type RegistrationStatus = "Active" | "PendingClubApproval";

export interface RegisterPayingAccountResponse {
  userId: string;
  roles: string[];
  status: RegistrationStatus;
  subscription: { plan: string; status: string; endDate: string } | null;
  clubJoinRequestId: string | null;
}

export type ClubJoinRequestStatus = "Pending" | "Approved" | "Rejected" | "Cancelled";

export interface ClubJoinRequestDto {
  requestId: string;
  alias: string;
  email: string;
  requestedAt: string;
  status: ClubJoinRequestStatus;
  decidedAt: string | null;
  decidedByAlias: string | null;
}

export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  message?: string;
}
