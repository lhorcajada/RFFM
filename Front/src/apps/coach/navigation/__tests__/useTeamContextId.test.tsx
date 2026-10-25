import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetCurrent = vi.fn();
vi.mock("../../services/configurationCoachService", () => ({
  default: { getCurrent: () => mockGetCurrent() },
}));

import { TEAM_NAV_TEAM_ID_KEY, useTeamContextId } from "../useTeamContextId";

function renderAt(path: string, isPlayer = false) {
  return renderHook(() => useTeamContextId(isPlayer), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
    ),
  });
}

describe("useTeamContextId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    mockGetCurrent.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("usa el teamId de la URL y lo recuerda para la sesión", () => {
    const { result } = renderAt("/coach/squad?teamId=team-1");

    expect(result.current).toBe("team-1");
    expect(sessionStorage.getItem(TEAM_NAV_TEAM_ID_KEY)).toBe("team-1");
  });

  it("usa el último equipo visto en la sesión cuando la URL no trae teamId", () => {
    sessionStorage.setItem(TEAM_NAV_TEAM_ID_KEY, "team-2");

    const { result } = renderAt("/coach/news");

    expect(result.current).toBe("team-2");
  });

  it("usa el equipo vinculado del jugador cuando no hay nada en la sesión", () => {
    localStorage.setItem("coach_player_teamId", "team-3");

    const { result } = renderAt("/coach/news", true);

    expect(result.current).toBe("team-3");
    expect(mockGetCurrent).not.toHaveBeenCalled();
  });

  it("usa el equipo preferido del entrenador como último recurso", async () => {
    mockGetCurrent.mockResolvedValue({ preferredTeamId: "team-4" });

    const { result } = renderAt("/coach/news");

    await waitFor(() => expect(result.current).toBe("team-4"));
  });

  it("devuelve null cuando no se puede resolver ningún equipo", async () => {
    const { result } = renderAt("/coach/news");

    await waitFor(() => expect(mockGetCurrent).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });

  it("no falla cuando el almacenamiento del navegador no está disponible", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    const { result } = renderAt("/coach/squad?teamId=team-5");

    expect(result.current).toBe("team-5");
  });
});
