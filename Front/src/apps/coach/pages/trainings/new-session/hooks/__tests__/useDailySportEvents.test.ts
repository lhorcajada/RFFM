import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useDailySportEvents } from "../useDailySportEvents";

const getSportEventsMock = vi.fn();
vi.mock("../../../../../services/sportEventService", () => ({
  getSportEvents: (...args: unknown[]) => getSportEventsMock(...args),
}));

describe("useDailySportEvents", () => {
  beforeEach(() => vi.clearAllMocks());

  it("no consulta el backend cuando no hay fecha", () => {
    const { result } = renderHook(() => useDailySportEvents("team-1", null));

    expect(getSportEventsMock).not.toHaveBeenCalled();
    expect(result.current.events).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it("consulta getSportEvents con startDate y endDate iguales a la fecha dada", async () => {
    getSportEventsMock.mockResolvedValue({ items: [], pageNumber: 1, pageSize: 100, totalItems: 0, totalPages: 1 });
    const { result } = renderHook(() => useDailySportEvents("team-1", "2026-09-10"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getSportEventsMock).toHaveBeenCalledWith("team-1", 1, 100, "2026-09-10", "2026-09-10");
  });

  it("expone los eventos deportivos devueltos para esa fecha", async () => {
    const events = [{ id: "ev-1", title: "Partido" }];
    getSportEventsMock.mockResolvedValue({ items: events, pageNumber: 1, pageSize: 100, totalItems: 1, totalPages: 1 });
    const { result } = renderHook(() => useDailySportEvents("team-1", "2026-09-10"));

    await waitFor(() => expect(result.current.events).toEqual(events));
  });

  it("vuelve a consultar cuando cambia la fecha", async () => {
    getSportEventsMock.mockResolvedValue({ items: [], pageNumber: 1, pageSize: 100, totalItems: 0, totalPages: 1 });
    const { rerender } = renderHook(({ date }) => useDailySportEvents("team-1", date), {
      initialProps: { date: "2026-09-10" },
    });

    await waitFor(() => expect(getSportEventsMock).toHaveBeenCalledTimes(1));

    rerender({ date: "2026-09-11" });

    await waitFor(() => expect(getSportEventsMock).toHaveBeenCalledTimes(2));
    expect(getSportEventsMock).toHaveBeenLastCalledWith("team-1", 1, 100, "2026-09-11", "2026-09-11");
  });

  it("vacía la lista de eventos si la fecha se borra tras haber cargado eventos", async () => {
    getSportEventsMock.mockResolvedValue({
      items: [{ id: "ev-1", title: "Partido" }],
      pageNumber: 1,
      pageSize: 100,
      totalItems: 1,
      totalPages: 1,
    });
    const { result, rerender } = renderHook(({ date }) => useDailySportEvents("team-1", date), {
      initialProps: { date: "2026-09-10" as string | null },
    });

    await waitFor(() => expect(result.current.events).toHaveLength(1));

    rerender({ date: null });

    await waitFor(() => expect(result.current.events).toEqual([]));
  });
});
