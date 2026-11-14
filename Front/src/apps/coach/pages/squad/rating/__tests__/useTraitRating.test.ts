import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getPlayersByTeam = vi.hoisted(() => vi.fn());
const getTeamLatestTraitRatings = vi.hoisted(() => vi.fn());
const createTeamTraitRatings = vi.hoisted(() => vi.fn());

vi.mock("../../../../services/teamplayerService", () => ({ getPlayersByTeam }));
vi.mock("../../../../services/traitRatingService", () => ({ getTeamLatestTraitRatings, createTeamTraitRatings }));

import { useTraitRating } from "../useTraitRating";
import type { TraitRating } from "../../../../types/traitRating";

const players = [
  { id: "juan", name: "Juan", lastName: "Pérez", alias: "", position: "Medio Centro", activePositionId: 6 },
  { id: "pedro", name: "Pedro", lastName: "Ruiz", alias: "", position: "Defensa Central", activePositionId: 4 },
  { id: "iker", name: "Iker", lastName: "Sanz", alias: "", position: "Portero", activePositionId: 1 },
];

function stored(teamPlayerId: string, levels: Record<string, number>, trend: TraitRating["trend"] = "same"): TraitRating {
  return {
    id: `r-${teamPlayerId}`,
    teamPlayerId,
    ratedAt: "2026-11-02T00:00:00Z",
    trend,
    levels: Object.entries(levels).map(([traitKey, level]) => ({ traitKey, level })),
  };
}

async function renderLoaded(ratings: TraitRating[] = [stored("juan", { traitCoverage: 4, traitPressing: 3 })]) {
  getPlayersByTeam.mockResolvedValue(players);
  getTeamLatestTraitRatings.mockResolvedValue(ratings);
  const hook = renderHook(() => useTraitRating("team-1", "season-1"));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

describe("useTraitRating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("carga solo jugadores de campo y excluye porteros", async () => {
    const { result } = await renderLoaded();

    expect(result.current.players.map((p) => p.id)).toEqual(["juan", "pedro"]);
    expect(getPlayersByTeam).toHaveBeenCalledWith("team-1", "season-1");
    expect(getTeamLatestTraitRatings).toHaveBeenCalledWith("team-1");
  });

  it("arranca con los niveles de la última valoración", async () => {
    const { result } = await renderLoaded();

    expect(result.current.draft.juan.levels).toEqual({ traitCoverage: 4, traitPressing: 3 });
    expect(result.current.previousLevels.juan).toEqual({ traitCoverage: 4, traitPressing: 3 });
  });

  it("un jugador sin valoración arranca sin niveles y con tendencia igual", async () => {
    const { result } = await renderLoaded();

    expect(result.current.draft.pedro).toEqual({ levels: {}, trend: "same" });
  });

  it("no hay nada que guardar al abrir", async () => {
    const { result } = await renderLoaded();

    expect(result.current.plan.items).toEqual([]);
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it("cambiar un nivel marca al jugador y envía todos sus niveles", async () => {
    const { result } = await renderLoaded();

    act(() => result.current.setLevel("juan", "traitCoverage", 5));

    expect(result.current.plan.items).toEqual([
      {
        teamPlayerId: "juan",
        trend: "same",
        levels: [
          { traitKey: "traitCoverage", level: 5 },
          { traitKey: "traitPressing", level: 3 },
        ],
      },
    ]);
    expect(result.current.hasUnsavedChanges).toBe(true);
  });

  it("solo se guardan los jugadores cambiados", async () => {
    const { result } = await renderLoaded();

    act(() => result.current.setLevel("pedro", "traitDuels", 2));

    expect(result.current.plan.items.map((i) => i.teamPlayerId)).toEqual(["pedro"]);
  });

  it("volver al nivel anterior deja de contar como cambio", async () => {
    const { result } = await renderLoaded();

    act(() => result.current.setLevel("juan", "traitCoverage", 5));
    act(() => result.current.setLevel("juan", "traitCoverage", 4));

    expect(result.current.plan.items).toEqual([]);
  });

  it("marcar la tendencia sin cambiar niveles también se guarda", async () => {
    const { result } = await renderLoaded();

    act(() => result.current.setTrend("juan", "down"));

    expect(result.current.plan.items).toEqual([
      expect.objectContaining({ teamPlayerId: "juan", trend: "down" }),
    ]);
  });

  it("quitar un nivel con null lo elimina del jugador", async () => {
    const { result } = await renderLoaded();

    act(() => result.current.setLevel("juan", "traitPressing", null));

    expect(result.current.draft.juan.levels).toEqual({ traitCoverage: 4 });
  });

  it("guarda con la fecha, devuelve cuántos y deja de haber cambios", async () => {
    createTeamTraitRatings.mockResolvedValue([stored("juan", { traitCoverage: 5, traitPressing: 3 })]);
    const { result } = await renderLoaded();
    act(() => result.current.setLevel("juan", "traitCoverage", 5));

    let saved = 0;
    await act(async () => {
      saved = await result.current.save("2026-11-09");
    });

    expect(saved).toBe(1);
    expect(createTeamTraitRatings).toHaveBeenCalledWith("team-1", {
      ratedAt: new Date("2026-11-09").toISOString(),
      ratings: [expect.objectContaining({ teamPlayerId: "juan" })],
    });
    expect(result.current.plan.items).toEqual([]);
    expect(result.current.previousLevels.juan.traitCoverage).toBe(5);
  });

  it("no llama a la API cuando no hay nada que guardar", async () => {
    const { result } = await renderLoaded();

    let saved = -1;
    await act(async () => {
      saved = await result.current.save("2026-11-09");
    });

    expect(saved).toBe(0);
    expect(createTeamTraitRatings).not.toHaveBeenCalled();
  });

  it("indica error de carga si falla la API", async () => {
    getPlayersByTeam.mockRejectedValue(new Error("boom"));
    getTeamLatestTraitRatings.mockResolvedValue([]);

    const { result } = renderHook(() => useTraitRating("team-1", null));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.loadError).toBe(true);
  });

  it("indica error de carga cuando falta el equipo", async () => {
    const { result } = renderHook(() => useTraitRating(null, null));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.loadError).toBe(true);
  });
});
