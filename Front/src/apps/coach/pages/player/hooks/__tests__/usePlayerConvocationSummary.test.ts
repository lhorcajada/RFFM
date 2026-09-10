import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const getPlayerConvocationSummaryMock = vi.fn();
vi.mock("../../../../services/convocationService", () => ({
  getPlayerConvocationSummary: (...args: unknown[]) => getPlayerConvocationSummaryMock(...args),
}));

import { usePlayerConvocationSummary } from "../usePlayerConvocationSummary";

describe("usePlayerConvocationSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no llama al servicio si no hay playerId", () => {
    const { result } = renderHook(() => usePlayerConvocationSummary());

    act(() => result.current.loadSummary(undefined));

    expect(getPlayerConvocationSummaryMock).not.toHaveBeenCalled();
  });

  it("carga el resumen y expone loadingSummary mientras está pendiente", async () => {
    let resolvePromise: (value: unknown) => void = () => {};
    getPlayerConvocationSummaryMock.mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve;
      }),
    );

    const { result } = renderHook(() => usePlayerConvocationSummary());

    act(() => {
      result.current.loadSummary("tp-1");
    });

    expect(result.current.loadingSummary).toBe(true);

    await act(async () => {
      resolvePromise({
        totalStarts: 5,
        totalConvocations: 8,
        lastDeconvokedMatch: null,
        lastJustifiedAbsenceMatch: null,
      });
    });

    await waitFor(() => expect(result.current.loadingSummary).toBe(false));
    expect(result.current.summary).toEqual({
      totalStarts: 5,
      totalConvocations: 8,
      lastDeconvokedMatch: null,
      lastJustifiedAbsenceMatch: null,
    });
  });

  it("no repite la llamada al servicio una vez cargado el resumen", async () => {
    getPlayerConvocationSummaryMock.mockResolvedValue({
      totalStarts: 1,
      totalConvocations: 2,
      lastDeconvokedMatch: null,
      lastJustifiedAbsenceMatch: null,
    });

    const { result } = renderHook(() => usePlayerConvocationSummary());

    await act(async () => {
      result.current.loadSummary("tp-1");
    });
    await waitFor(() => expect(result.current.loadingSummary).toBe(false));

    act(() => {
      result.current.loadSummary("tp-1");
    });

    expect(getPlayerConvocationSummaryMock).toHaveBeenCalledTimes(1);
  });

  it("mantiene la pestaña usable si el servicio falla", async () => {
    getPlayerConvocationSummaryMock.mockRejectedValue(new Error("network error"));

    const { result } = renderHook(() => usePlayerConvocationSummary());

    await act(async () => {
      result.current.loadSummary("tp-1");
    });

    await waitFor(() => expect(result.current.loadingSummary).toBe(false));
    expect(result.current.summary).toBeNull();
  });
});
