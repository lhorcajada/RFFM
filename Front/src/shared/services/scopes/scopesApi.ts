import { client } from "../../../core/api/client";
import { scopeMock } from "./__mocks__/scopeMock";
import type {
  ScopeMember,
  ScopeInvitation,
  ListScopeMembersParams,
  RegenerateInvitationPayload,
  RegenerateInvitationResponse,
  LeaveScopeResponse,
} from "../../types/scope";

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "1";

export class ScopesApi {
  async listScopeMembers(
    params: ListScopeMembersParams,
  ): Promise<ScopeMember[]> {
    if (USE_MOCK) {
      return scopeMock.listScopeMembers(params);
    }
    const res = await client.get("/api/scopes/members", { params });
    return res.data as ScopeMember[];
  }

  async removeScopeMember(membershipId: string): Promise<void> {
    if (USE_MOCK) {
      await scopeMock.removeScopeMember(membershipId);
      return;
    }
    await client.delete(
      `/api/scopes/members/${encodeURIComponent(membershipId)}`,
    );
  }

  async leaveScope(): Promise<LeaveScopeResponse> {
    if (USE_MOCK) {
      return scopeMock.leaveScope();
    }
    const res = await client.post("/api/scopes/members/leave");
    return res.data as LeaveScopeResponse;
  }

  async regenerateInvitation(
    payload: RegenerateInvitationPayload,
  ): Promise<RegenerateInvitationResponse> {
    if (USE_MOCK) {
      return scopeMock.regenerateInvitation(payload);
    }
    const res = await client.post(
      "/api/scopes/invitations/regenerate",
      payload,
    );
    return res.data as RegenerateInvitationResponse;
  }

  async getInvitation(
    scopeKind: "club" | "team",
    scopeId: string,
  ): Promise<ScopeInvitation> {
    if (USE_MOCK) {
      return scopeMock.getInvitation(scopeKind, scopeId);
    }
    const res = await client.get("/api/scopes/invitations", {
      params: { scopeKind, scopeId },
    });
    return res.data as ScopeInvitation;
  }
}

export const scopesApi = new ScopesApi();
