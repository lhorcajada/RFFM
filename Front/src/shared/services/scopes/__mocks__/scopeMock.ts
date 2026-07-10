import type {
  ScopeMember,
  ScopeInvitation,
  RegenerateInvitationPayload,
  RegenerateInvitationResponse,
  LeaveScopeResponse,
  ListScopeMembersParams,
} from "../../../types/scope";

const INITIAL_MEMBERS: ScopeMember[] = [
  {
    membershipId: "mem-creator-1",
    userId: "user-creator-1",
    alias: "entrenador.jefe",
    email: "coach@mock.fc",
    membershipKind: "Coach",
    joinedAt: "2024-08-01T10:00:00.000Z",
    isCreator: true,
  },
  {
    membershipId: "mem-player-1",
    userId: "user-player-1",
    alias: "delantero9",
    email: "player1@mock.fc",
    membershipKind: "Player",
    joinedAt: "2024-09-12T09:30:00.000Z",
    isCreator: false,
  },
  {
    membershipId: "mem-family-1",
    userId: "user-family-1",
    alias: "madre.delantero9",
    email: "family1@mock.fc",
    membershipKind: "FamilyPlayer",
    joinedAt: "2024-09-20T17:15:00.000Z",
    isCreator: false,
  },
  {
    membershipId: "mem-follower-1",
    userId: "user-follower-1",
    alias: "aficionado.anon",
    email: "follower1@mock.fc",
    membershipKind: "Follower",
    joinedAt: "2024-10-05T12:00:00.000Z",
    isCreator: false,
  },
  {
    membershipId: "mem-clubmember-1",
    userId: "user-club-1",
    alias: "directivo.club",
    email: "clubmember1@mock.fc",
    membershipKind: "ClubMember",
    joinedAt: "2024-11-02T08:45:00.000Z",
    isCreator: false,
  },
];

let members: ScopeMember[] = INITIAL_MEMBERS.map((m) => ({ ...m }));

function generateRandomCode(length = 8): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

const CURRENT_CODE_BY_SCOPE = new Map<string, string>();

function scopeKey(scopeKind: "club" | "team", scopeId: string): string {
  return `${scopeKind}:${scopeId}`;
}

export const scopeMock = {
  async listScopeMembers(_params: ListScopeMembersParams): Promise<ScopeMember[]> {
    await new Promise((r) => setTimeout(r, 250));
    return members.map((m) => ({ ...m }));
  },

  async removeScopeMember(membershipId: string): Promise<void> {
    await new Promise((r) => setTimeout(r, 300));
    members = members.filter((m) => m.membershipId !== membershipId);
  },

  async leaveScope(): Promise<LeaveScopeResponse> {
    await new Promise((r) => setTimeout(r, 250));
    return {
      leftScope: { kind: "club", id: "mock-club-1", name: "Mock FC" },
    };
  },

  async regenerateInvitation(
    payload: RegenerateInvitationPayload,
  ): Promise<RegenerateInvitationResponse> {
    await new Promise((r) => setTimeout(r, 250));
    const newCode = generateRandomCode(8);
    CURRENT_CODE_BY_SCOPE.set(scopeKey(payload.scopeKind, payload.scopeId), newCode);
    return {
      scopeKind: payload.scopeKind,
      scopeId: payload.scopeId,
      newCode,
    };
  },

  async getInvitation(
    scopeKind: "club" | "team",
    scopeId: string,
  ): Promise<ScopeInvitation> {
    await new Promise((r) => setTimeout(r, 250));
    const key = scopeKey(scopeKind, scopeId);
    let code = CURRENT_CODE_BY_SCOPE.get(key);
    if (!code) {
      code = "ABC12345";
      CURRENT_CODE_BY_SCOPE.set(key, code);
    }
    return { scopeKind, scopeId, code };
  },
};
