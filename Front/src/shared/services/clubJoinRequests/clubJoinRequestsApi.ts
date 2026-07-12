import { client } from "../../../core/api/client";
import { clubJoinRequestsMock } from "./__mocks__/clubJoinRequestsMock";
import type { ClubJoinRequestDto, ClubJoinRequestStatus } from "../../types/scope";

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "1";

export type ClubJoinRequestStatusFilter = "pending" | "decided" | "all";

export class ClubJoinRequestsApi {
  async list(clubId: string, status: ClubJoinRequestStatusFilter): Promise<ClubJoinRequestDto[]> {
    if (USE_MOCK) {
      return clubJoinRequestsMock.list(clubId, status);
    }
    const res = await client.get(`/api/clubs/${encodeURIComponent(clubId)}/join-requests`, {
      params: { status },
    });
    return res.data as ClubJoinRequestDto[];
  }

  async getPendingCount(clubId: string): Promise<number> {
    if (USE_MOCK) {
      return clubJoinRequestsMock.getPendingCount(clubId);
    }
    const res = await client.get(`/api/clubs/${encodeURIComponent(clubId)}/join-requests/count`);
    return (res.data as { pendingCount: number }).pendingCount;
  }

  async approve(requestId: string): Promise<void> {
    if (USE_MOCK) {
      return clubJoinRequestsMock.approve(requestId);
    }
    await client.post(`/api/club-join-requests/${encodeURIComponent(requestId)}/approve`);
  }

  async reject(requestId: string): Promise<void> {
    if (USE_MOCK) {
      return clubJoinRequestsMock.reject(requestId);
    }
    await client.post(`/api/club-join-requests/${encodeURIComponent(requestId)}/reject`);
  }
}

export const clubJoinRequestsApi = new ClubJoinRequestsApi();
