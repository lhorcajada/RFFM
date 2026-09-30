import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const getSessionByIdMock = vi.fn();
vi.mock("../../../../services/trainingService", () => ({
  default: { getSessionById: (...args: unknown[]) => getSessionByIdMock(...args) },
}));

import { useSessionDetail } from "../useSessionDetail";

describe("useSessionDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sin sesión no pide nada y no expone detalle", () => {
    const { result } = renderHook(() => useSessionDetail(null));

    expect(getSessionByIdMock).not.toHaveBeenCalled();
    expect(result.current.detail).toBeNull();
  });

  it("pide el detalle de la sesión elegida y lo expone", async () => {
    const detail = { id: "ses-1", name: "Sesión 1", objetivoGeneral: "Mover al rival", blocks: [], targets: [] };
    getSessionByIdMock.mockResolvedValue(detail);

    const { result } = renderHook(() => useSessionDetail("ses-1"));

    await waitFor(() => expect(result.current.detail).toEqual(detail));
    expect(getSessionByIdMock).toHaveBeenCalledWith("ses-1");
    expect(result.current.loading).toBe(false);
  });

  it("si falla la carga no expone detalle", async () => {
    getSessionByIdMock.mockRejectedValue(new Error("404"));

    const { result } = renderHook(() => useSessionDetail("ses-1"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.detail).toBeNull();
  });
});
