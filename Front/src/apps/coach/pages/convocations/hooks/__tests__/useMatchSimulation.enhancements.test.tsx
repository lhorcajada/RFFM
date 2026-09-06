import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  useMatchSimulation,
  MAX_TOTAL_WINDOWS,
  MAX_SECOND_HALF_WINDOWS,
} from "../useMatchSimulation";

function commitAWindow(result: { current: ReturnType<typeof useMatchSimulation> }) {
  act(() => {
    result.current.startPrepare();
  });
  act(() => {
    result.current.commitWindow();
  });
}

describe("useMatchSimulation - unlimited substitution windows (friendlies)", () => {
  it("keeps canOpenWindow true past MAX_TOTAL_WINDOWS when enableWindowLimits is false", () => {
    const { result } = renderHook(() => useMatchSimulation({ enableWindowLimits: false }));
    act(() => {
      result.current.initSimulation({ 0: "p1" });
    });

    for (let i = 0; i < MAX_TOTAL_WINDOWS + 1; i++) {
      commitAWindow(result);
    }

    expect(result.current.windowsTotal).toBeGreaterThan(MAX_TOTAL_WINDOWS);
    expect(result.current.canOpenWindow).toBe(true);
  });

  it("keeps canOpenWindow true past MAX_SECOND_HALF_WINDOWS in the 2nd half when enableWindowLimits is false", () => {
    const { result } = renderHook(() => useMatchSimulation({ enableWindowLimits: false }));
    act(() => {
      result.current.initSimulation({ 0: "p1" });
    });
    act(() => {
      result.current.startSecondHalf();
    });

    for (let i = 0; i < MAX_SECOND_HALF_WINDOWS + 1; i++) {
      commitAWindow(result);
    }

    expect(result.current.windowsInSecondHalf).toBeGreaterThan(MAX_SECOND_HALF_WINDOWS);
    expect(result.current.canOpenWindow).toBe(true);
  });

  it("keeps the existing quota behavior unchanged when enableWindowLimits is true/default", () => {
    const { result } = renderHook(() => useMatchSimulation());
    act(() => {
      result.current.initSimulation({ 0: "p1" });
    });

    for (let i = 0; i < MAX_TOTAL_WINDOWS; i++) {
      commitAWindow(result);
    }

    expect(result.current.windowsTotal).toBe(MAX_TOTAL_WINDOWS);
    expect(result.current.canOpenWindow).toBe(false);
  });
});
