import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../services/authService", () => ({
  coachAuthService: {
    getRoles: vi.fn(),
  },
}));

import { coachAuthService } from "../../services/authService";
import { useIsPlayerRole } from "../useIsPlayerRole";

describe("useIsPlayerRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true for a Player role", () => {
    vi.mocked(coachAuthService.getRoles).mockReturnValue(["Player"]);
    const { result } = renderHook(() => useIsPlayerRole());
    expect(result.current).toBe(true);
  });

  it("returns true for a FamilyMember role", () => {
    vi.mocked(coachAuthService.getRoles).mockReturnValue(["FamilyMember"]);
    const { result } = renderHook(() => useIsPlayerRole());
    expect(result.current).toBe(true);
  });

  it("returns false for a Coach role", () => {
    vi.mocked(coachAuthService.getRoles).mockReturnValue(["Coach"]);
    const { result } = renderHook(() => useIsPlayerRole());
    expect(result.current).toBe(false);
  });

  it("returns false when Player and Administrator roles are both present (admin bypass)", () => {
    vi.mocked(coachAuthService.getRoles).mockReturnValue(["Player", "Administrator"]);
    const { result } = renderHook(() => useIsPlayerRole());
    expect(result.current).toBe(false);
  });

  it("has no navigation side-effects (pure role check)", () => {
    // No react-router mocking here at all — if this hook tried to call
    // useNavigate()/useLocation() outside a Router, rendering would throw.
    vi.mocked(coachAuthService.getRoles).mockReturnValue(["Player"]);
    expect(() => renderHook(() => useIsPlayerRole())).not.toThrow();
  });
});
