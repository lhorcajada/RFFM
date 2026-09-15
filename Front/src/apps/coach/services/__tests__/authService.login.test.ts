import { describe, expect, it, vi, beforeEach } from "vitest";

const mockPost = vi.fn();

vi.mock("../../../../core/api/client", () => ({
  client: { post: (...args: unknown[]) => mockPost(...args) },
}));

import { coachAuthService } from "../authService";

describe("coachAuthService.login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("clears a stale coach_roles cache from a previous session so hasRole() reflects only the fresh token", async () => {
    // Simulate a role cached by a previous session/account (e.g. from accepting a team
    // invitation earlier) that must not leak into the new session's permission checks.
    localStorage.setItem("coach_roles", JSON.stringify(["Coach"]));
    mockPost.mockResolvedValue({ data: { token: "new-jwt-without-roles-claim" } });

    await coachAuthService.login("temp-token");

    expect(localStorage.getItem("coach_roles")).toBeNull();
  });
});
