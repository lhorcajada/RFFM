import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { PlayerObservation } from "../../../../services/playerTrackingService";

const getPlayerObservationsMock = vi.fn();
const createPlayerObservationMock = vi.fn();
const updatePlayerObservationMock = vi.fn();
const deletePlayerObservationMock = vi.fn();
vi.mock("../../../../services/playerTrackingService", () => ({
  getPlayerObservations: (...args: unknown[]) => getPlayerObservationsMock(...args),
  createPlayerObservation: (...args: unknown[]) => createPlayerObservationMock(...args),
  updatePlayerObservation: (...args: unknown[]) => updatePlayerObservationMock(...args),
  deletePlayerObservation: (...args: unknown[]) => deletePlayerObservationMock(...args),
}));

import { usePlayerObservations } from "../usePlayerObservations";

function buildObservation(overrides: Partial<PlayerObservation> = {}): PlayerObservation {
  return {
    id: "obs-1",
    date: "2026-09-07",
    kind: "GameModel",
    subprincipioId: "sub-1",
    momentName: "Ataque organizado",
    principleLabel: "2. Ataque posicional",
    subprincipioLabel: "2.3 Circular para desordenar",
    assessment: "NotAchieved",
    comment: null,
    createdAt: "2026-09-07T18:00:00Z",
    trainingSessionId: null,
    trainingSessionName: null,
    attitudeKey: null,
    attitudeLabel: null,
    ...overrides,
  };
}

describe("usePlayerObservations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no llama al servicio sin teamId o sin teamPlayerId", () => {
    renderHook(() => usePlayerObservations(undefined, "tp-1"));
    renderHook(() => usePlayerObservations("team-1", undefined));

    expect(getPlayerObservationsMock).not.toHaveBeenCalled();
  });

  it("carga las observaciones del jugador", async () => {
    const observations = [buildObservation()];
    getPlayerObservationsMock.mockResolvedValue(observations);

    const { result } = renderHook(() => usePlayerObservations("team-1", "tp-1"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getPlayerObservationsMock).toHaveBeenCalledWith("team-1", "tp-1");
    expect(result.current.observations).toEqual(observations);
    expect(result.current.error).toBeNull();
  });

  it("expone un mensaje de error si falla la carga y permite recargar", async () => {
    getPlayerObservationsMock.mockRejectedValueOnce(new Error("network error"));
    const { result } = renderHook(() => usePlayerObservations("team-1", "tp-1"));
    await waitFor(() => expect(result.current.error).toBe("No se pudieron cargar las observaciones"));

    getPlayerObservationsMock.mockResolvedValue([buildObservation()]);
    act(() => result.current.reload());

    await waitFor(() => expect(result.current.observations).toHaveLength(1));
    expect(result.current.error).toBeNull();
  });

  it("create añade la observación creada manteniendo el orden por fecha descendente", async () => {
    getPlayerObservationsMock.mockResolvedValue([
      buildObservation({ id: "a", date: "2026-09-14" }),
      buildObservation({ id: "b", date: "2026-09-01" }),
    ]);
    createPlayerObservationMock.mockResolvedValue(buildObservation({ id: "c", date: "2026-09-07" }));
    const { result } = renderHook(() => usePlayerObservations("team-1", "tp-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const request = { date: "2026-09-07", subprincipioId: "sub-1", assessment: "Partial" as const, comment: null };
    await act(async () => {
      await result.current.create(request);
    });

    expect(createPlayerObservationMock).toHaveBeenCalledWith("team-1", "tp-1", request);
    expect(result.current.observations.map((o) => o.id)).toEqual(["a", "c", "b"]);
  });

  it("create propaga el error sin modificar la lista", async () => {
    getPlayerObservationsMock.mockResolvedValue([buildObservation({ id: "a" })]);
    createPlayerObservationMock.mockRejectedValue(new Error("400"));
    const { result } = renderHook(() => usePlayerObservations("team-1", "tp-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      result.current.create({ date: "2026-09-07", subprincipioId: "sub-1", assessment: "Partial" }),
    ).rejects.toThrow("400");
    expect(result.current.observations.map((o) => o.id)).toEqual(["a"]);
  });

  it("update sustituye la observación por la respuesta del servidor", async () => {
    getPlayerObservationsMock.mockResolvedValue([buildObservation({ id: "a" }), buildObservation({ id: "b" })]);
    updatePlayerObservationMock.mockResolvedValue(buildObservation({ id: "a", assessment: "Achieved", comment: "Ya lo hace" }));
    const { result } = renderHook(() => usePlayerObservations("team-1", "tp-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.update("a", { assessment: "Achieved", comment: "Ya lo hace" });
    });

    expect(updatePlayerObservationMock).toHaveBeenCalledWith("team-1", "tp-1", "a", { assessment: "Achieved", comment: "Ya lo hace" });
    expect(result.current.observations.map((o) => [o.id, o.assessment])).toEqual([
      ["a", "Achieved"],
      ["b", "NotAchieved"],
    ]);
  });

  it("remove quita la observación de la lista", async () => {
    getPlayerObservationsMock.mockResolvedValue([buildObservation({ id: "a" }), buildObservation({ id: "b" })]);
    deletePlayerObservationMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => usePlayerObservations("team-1", "tp-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.remove("a");
    });

    expect(deletePlayerObservationMock).toHaveBeenCalledWith("team-1", "tp-1", "a");
    expect(result.current.observations.map((o) => o.id)).toEqual(["b"]);
  });

  it("remove propaga el error sin quitar la observación", async () => {
    getPlayerObservationsMock.mockResolvedValue([buildObservation({ id: "a" })]);
    deletePlayerObservationMock.mockRejectedValue(new Error("404"));
    const { result } = renderHook(() => usePlayerObservations("team-1", "tp-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(result.current.remove("a")).rejects.toThrow("404");
    expect(result.current.observations.map((o) => o.id)).toEqual(["a"]);
  });
});
