import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const getPendingCount = vi.hoisted(() => vi.fn());

vi.mock("../../../../../../../shared/services/clubJoinRequests/clubJoinRequestsApi", () => ({
  clubJoinRequestsApi: { getPendingCount },
}));

import { useClubPendingRequests } from "../useClubPendingRequests";

describe("useClubPendingRequests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devuelve el número de solicitudes pendientes del club", async () => {
    getPendingCount.mockResolvedValue(3);

    const { result } = renderHook(() => useClubPendingRequests("club-1"));

    await waitFor(() => expect(result.current.count).toBe(3));
    expect(getPendingCount).toHaveBeenCalledWith("club-1");
  });

  it("devuelve 0 si la consulta falla", async () => {
    getPendingCount.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useClubPendingRequests("club-1"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.count).toBe(0);
  });

  it("no consulta si no hay club", () => {
    renderHook(() => useClubPendingRequests(undefined));

    expect(getPendingCount).not.toHaveBeenCalled();
  });
});
