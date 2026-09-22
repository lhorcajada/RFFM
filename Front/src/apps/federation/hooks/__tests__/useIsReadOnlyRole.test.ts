import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../coach/services/authService", () => ({
  coachAuthService: {
    getRoles: vi.fn(),
  },
}));

import { coachAuthService } from "../../../coach/services/authService";
import { useIsReadOnlyRole } from "../useIsReadOnlyRole";

describe("useIsReadOnlyRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true for a Player role", () => {
    vi.mocked(coachAuthService.getRoles).mockReturnValue(["Player"]);
    const { result } = renderHook(() => useIsReadOnlyRole());
    expect(result.current).toBe(true);
  });

  it("returns true for a FamilyMember role", () => {
    vi.mocked(coachAuthService.getRoles).mockReturnValue(["FamilyMember"]);
    const { result } = renderHook(() => useIsReadOnlyRole());
    expect(result.current).toBe(true);
  });

  it("returns false for a Federation role", () => {
    vi.mocked(coachAuthService.getRoles).mockReturnValue(["Federation"]);
    const { result } = renderHook(() => useIsReadOnlyRole());
    expect(result.current).toBe(false);
  });

  it("returns false when Player and Administrator roles are both present (admin bypass)", () => {
    vi.mocked(coachAuthService.getRoles).mockReturnValue(["Player", "Administrator"]);
    const { result } = renderHook(() => useIsReadOnlyRole());
    expect(result.current).toBe(false);
  });

  it("returns false when Player and Federation roles are both present", () => {
    vi.mocked(coachAuthService.getRoles).mockReturnValue(["Player", "Federation"]);
    const { result } = renderHook(() => useIsReadOnlyRole());
    expect(result.current).toBe(false);
  });
});
