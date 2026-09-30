import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { GameModel, Principle, Subprincipio } from "../../../../types/gameModel";

const getActiveSeasonMock = vi.fn();
vi.mock("../../../../services/seasonService", () => ({
  default: { getActiveSeason: (...args: unknown[]) => getActiveSeasonMock(...args) },
}));

const getByTeamIdAndSeasonMock = vi.fn();
vi.mock("../../../../services/gameModelService", () => ({
  default: { getByTeamIdAndSeason: (...args: unknown[]) => getByTeamIdAndSeasonMock(...args) },
}));

import { useSubprincipioOptions } from "../useSubprincipioOptions";

function sub(apiId: string | undefined, numero: string, titulo: string): Subprincipio {
  return { id: Math.random(), apiId, numero, titulo, texto: "", zonas: [], subSubPrincipios: [], notas: [] };
}

function principle(gameMomentName: string, numero: number, titulo: string, subprincipios: Subprincipio[]): Principle {
  return { id: numero, gameMomentId: 1, gameMomentName, numero, titulo, texto: "", subprincipios, notas: [] };
}

function model(principles: Principle[]): GameModel {
  return { id: "gm-1", teamId: "team-1", name: "Modelo", season: "2026-2027", principles, setPieceRules: [], openIssues: [] };
}

describe("useSubprincipioOptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getActiveSeasonMock.mockResolvedValue({ id: "season-1", name: "2026-2027" });
  });

  it("aplana los subprincipios del modelo de la temporada activa agrupados por Fase › Principio", async () => {
    getByTeamIdAndSeasonMock.mockResolvedValue(
      model([
        principle("Defensa organizada", 1, "Presión tras superar primera línea", [sub("s-11", "1.1", "Repliegue")]),
        principle("Ataque organizado", 2, "Ataque posicional", [
          sub("s-23", "2.3", "Circular para desordenar"),
          sub(undefined, "2.4", "Sin guardar"),
        ]),
      ]),
    );

    const { result } = renderHook(() => useSubprincipioOptions("team-1"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getByTeamIdAndSeasonMock).toHaveBeenCalledWith("team-1", "2026-2027");
    expect(result.current.hasModel).toBe(true);
    expect(result.current.options).toEqual([
      { id: "s-11", label: "1.1 Repliegue", group: "Defensa organizada › 1. Presión tras superar primera línea" },
      { id: "s-23", label: "2.3 Circular para desordenar", group: "Ataque organizado › 2. Ataque posicional" },
    ]);
  });

  it("indica que no hay modelo cuando el equipo no tiene modelo en la temporada activa", async () => {
    getByTeamIdAndSeasonMock.mockResolvedValue(null);

    const { result } = renderHook(() => useSubprincipioOptions("team-1"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasModel).toBe(false);
    expect(result.current.options).toEqual([]);
  });

  it("indica que no hay modelo cuando no hay temporada activa", async () => {
    getActiveSeasonMock.mockResolvedValue(null);

    const { result } = renderHook(() => useSubprincipioOptions("team-1"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasModel).toBe(false);
    expect(getByTeamIdAndSeasonMock).not.toHaveBeenCalled();
  });
});
