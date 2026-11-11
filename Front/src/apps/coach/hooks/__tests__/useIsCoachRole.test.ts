import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../services/authService", () => ({
  coachAuthService: {
    getRoles: vi.fn(),
  },
}));

import { coachAuthService } from "../../services/authService";
import { useIsCoachRole } from "../useIsCoachRole";

describe("useIsCoachRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devuelve true para un usuario con el rol Coach", () => {
    vi.mocked(coachAuthService.getRoles).mockReturnValue(["Coach"]);
    const { result } = renderHook(() => useIsCoachRole());
    expect(result.current).toBe(true);
  });

  it("devuelve false para un usuario con el rol Player", () => {
    vi.mocked(coachAuthService.getRoles).mockReturnValue(["Player"]);
    const { result } = renderHook(() => useIsCoachRole());
    expect(result.current).toBe(false);
  });

  it("calcula el rol una sola vez al montarse", () => {
    vi.mocked(coachAuthService.getRoles).mockReturnValue(["Coach"]);
    const { rerender } = renderHook(() => useIsCoachRole());
    rerender();
    expect(coachAuthService.getRoles).toHaveBeenCalledTimes(1);
  });
});
