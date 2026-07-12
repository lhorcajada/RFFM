import type { ClubJoinRequestDto } from "../../../types/scope";

const MOCK_REQUESTS: ClubJoinRequestDto[] = [
  {
    requestId: "mock-req-1",
    alias: "coach1",
    email: "coach1@example.com",
    requestedAt: new Date().toISOString(),
    status: "Pending",
    decidedAt: null,
    decidedByAlias: null,
  },
];

export const clubJoinRequestsMock = {
  async list(_clubId: string, status: "pending" | "decided" | "all") {
    await new Promise((r) => setTimeout(r, 200));
    if (status === "pending") return MOCK_REQUESTS.filter((r) => r.status === "Pending");
    if (status === "decided") return MOCK_REQUESTS.filter((r) => r.status !== "Pending");
    return MOCK_REQUESTS;
  },
  async getPendingCount(_clubId: string) {
    await new Promise((r) => setTimeout(r, 200));
    return MOCK_REQUESTS.filter((r) => r.status === "Pending").length;
  },
  async approve(_requestId: string) {
    await new Promise((r) => setTimeout(r, 200));
  },
  async reject(_requestId: string) {
    await new Promise((r) => setTimeout(r, 200));
  },
};
