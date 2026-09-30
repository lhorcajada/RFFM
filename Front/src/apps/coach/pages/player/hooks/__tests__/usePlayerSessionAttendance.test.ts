import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const getConvocationsMock = vi.fn();
vi.mock("../../../../services/convocationService", () => ({
  getConvocations: (...args: unknown[]) => getConvocationsMock(...args),
}));

import { usePlayerSessionAttendance } from "../usePlayerSessionAttendance";

function convocation(teamPlayerId: string, assistanceTypeId: number | null) {
  return { id: `c-${teamPlayerId}`, player: { id: teamPlayerId }, status: 1, assistanceTypeId };
}

describe("usePlayerSessionAttendance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sin evento vinculado indica no-event sin llamar a la API", () => {
    const { result } = renderHook(() => usePlayerSessionAttendance(null, "tp-1"));

    expect(result.current.attendance).toBe("no-event");
    expect(getConvocationsMock).not.toHaveBeenCalled();
  });

  it.each([
    [1, "attended"],
    [4, "late"],
    [2, "absent-excused"],
    [3, "absent-unexcused"],
  ])("con asistencia %i devuelve %s", async (assistanceTypeId, expected) => {
    getConvocationsMock.mockResolvedValue([convocation("otro", 1), convocation("tp-1", assistanceTypeId)]);

    const { result } = renderHook(() => usePlayerSessionAttendance("ev-1", "tp-1"));

    await waitFor(() => expect(result.current.attendance).toBe(expected));
    expect(getConvocationsMock).toHaveBeenCalledWith("ev-1");
  });

  it("si el jugador no tiene asistencia registrada devuelve unknown", async () => {
    getConvocationsMock.mockResolvedValue([convocation("otro", 1), convocation("tp-1", null)]);

    const { result } = renderHook(() => usePlayerSessionAttendance("ev-1", "tp-1"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.attendance).toBe("unknown");
  });

  it("si el jugador no está en la convocatoria o falla la carga devuelve unknown", async () => {
    getConvocationsMock.mockRejectedValue(new Error("403"));

    const { result } = renderHook(() => usePlayerSessionAttendance("ev-1", "tp-1"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.attendance).toBe("unknown");
  });
});
