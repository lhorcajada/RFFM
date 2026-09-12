import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Reproduces real test files (e.g. Register.test.tsx, Settings.test.tsx) that mock
// coachAuthService with only the methods they need, without getRoles — AppHeader (and
// this hook) must not crash when rendered incidentally inside such a test's tree.
vi.mock("../../../apps/coach/services/authService", () => ({
  coachAuthService: {
    isAuthenticated: () => true,
  },
}));

vi.mock("../../../apps/coach/services/coachApi", () => ({
  getMyProfile: vi.fn().mockResolvedValue(null),
}));

import useMyPendingSanctionsCount from "../useMyPendingSanctionsCount";

describe("useMyPendingSanctionsCount — resilience to incomplete authService mocks", () => {
  it("does not throw and returns not visible when coachAuthService.getRoles is missing", () => {
    const { result } = renderHook(() => useMyPendingSanctionsCount());

    expect(result.current.visible).toBe(false);
    expect(result.current.count).toBe(0);
  });
});
