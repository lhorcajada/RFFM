import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { TrainingSession } from "../../../../types/training";

const getSessionsMock = vi.fn();
vi.mock("../../../../services/trainingService", () => ({
  default: { getSessions: (...args: unknown[]) => getSessionsMock(...args) },
}));

import { useRecentSessions } from "../useRecentSessions";

function session(id: string, date: string | null): TrainingSession {
  return {
    id,
    name: `Sesión ${id}`,
    description: "",
    date,
    startTime: null,
    isAssociatedToPlan: false,
    exerciseCount: 0,
    targets: [],
  };
}

describe("useRecentSessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-20T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("devuelve solo las sesiones con fecha de los últimos 30 días, la más reciente primero", async () => {
    getSessionsMock.mockResolvedValue([
      session("hace-10", "2026-10-10T00:00:00"),
      session("hace-40", "2026-09-10T00:00:00"),
      session("mañana", "2026-10-21T00:00:00"),
      session("sin-fecha", null),
      session("hoy", "2026-10-20T00:00:00"),
      session("hace-30", "2026-09-20T00:00:00"),
    ]);

    const { result } = renderHook(() => useRecentSessions("team-1"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getSessionsMock).toHaveBeenCalledWith("team-1");
    expect(result.current.sessions.map((s) => s.id)).toEqual(["hoy", "hace-10", "hace-30"]);
  });

  it("si falla la carga devuelve una lista vacía", async () => {
    getSessionsMock.mockRejectedValue(new Error("403"));

    const { result } = renderHook(() => useRecentSessions("team-1"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.sessions).toEqual([]);
  });
});
