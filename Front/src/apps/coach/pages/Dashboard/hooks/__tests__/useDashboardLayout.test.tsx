import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseMediaQuery = vi.fn();
vi.mock("@mui/material/useMediaQuery", () => ({
  default: (...args: unknown[]) => mockUseMediaQuery(...args),
}));

import { useDashboardLayout } from "../useDashboardLayout";

function simulateViewport(width: number) {
  mockUseMediaQuery.mockImplementation((query: string) => {
    const max = /max-width:\s*([\d.]+)px/.exec(query);
    if (max) return width <= Number(max[1]);
    const min = /min-width:\s*([\d.]+)px/.exec(query);
    if (min) return width >= Number(min[1]);
    return false;
  });
}

describe("useDashboardLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devuelve mobile en una pantalla de 390 px", () => {
    simulateViewport(390);
    const { result } = renderHook(() => useDashboardLayout());
    expect(result.current).toBe("mobile");
  });

  it("devuelve tablet en una pantalla de 834 px", () => {
    simulateViewport(834);
    const { result } = renderHook(() => useDashboardLayout());
    expect(result.current).toBe("tablet");
  });

  it("devuelve desktop en una pantalla de 1440 px", () => {
    simulateViewport(1440);
    const { result } = renderHook(() => useDashboardLayout());
    expect(result.current).toBe("desktop");
  });
});
