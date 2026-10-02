import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const getSessionEvaluationsMock = vi.fn();
vi.mock("../../../../services/playerTrackingService", () => ({
  getSessionEvaluations: (...args: unknown[]) => getSessionEvaluationsMock(...args),
}));

import { useSessionEvaluations } from "../useSessionEvaluations";

const ITEM = {
  sessionId: "ses-1",
  name: "10. Desorganizar rival",
  date: "2026-10-01",
  isHeld: true,
  hasCalendarEvent: true,
  assistanceTypeId: 1,
  evaluation: null,
};

describe("useSessionEvaluations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("carga las sesiones del jugador", async () => {
    getSessionEvaluationsMock.mockResolvedValue([ITEM]);

    const { result } = renderHook(() => useSessionEvaluations("team-1", "tp-1"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getSessionEvaluationsMock).toHaveBeenCalledWith("team-1", "tp-1");
    expect(result.current.items).toEqual([ITEM]);
    expect(result.current.error).toBeNull();
  });

  it("expone el error y permite recargar", async () => {
    getSessionEvaluationsMock.mockRejectedValueOnce(new Error("500"));
    const { result } = renderHook(() => useSessionEvaluations("team-1", "tp-1"));
    await waitFor(() => expect(result.current.error).toBe("No se pudieron cargar las sesiones"));

    getSessionEvaluationsMock.mockResolvedValue([ITEM]);
    act(() => result.current.reload());

    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.error).toBeNull();
  });
});
