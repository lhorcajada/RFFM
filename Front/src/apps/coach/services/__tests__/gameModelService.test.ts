import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

vi.mock("../../../../core/api/client", () => ({
  client: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    put: (...args: unknown[]) => mockPut(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

import gameModelService from "../gameModelService";

describe("gameModelService.getAdnOptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("aplana el GameModel del equipo en listas de Subprincipio y SubSubPrincipio", async () => {
    mockGet.mockResolvedValue({
      data: {
        id: "model-1",
        teamId: "team-1",
        name: "Modelo",
        season: "2026-2027",
        principles: [
          {
            id: "principle-1",
            gameMomentId: 1,
            gameMomentName: "Fase defensiva",
            key: "p1",
            numero: 1,
            titulo: "Defensa organizada",
            texto: "",
            notas: [],
            subprincipios: [
              {
                id: "sub-1",
                key: "sp1",
                numero: "1.1",
                titulo: "Presión alta",
                texto: "",
                notas: [],
                zonas: [
                  {
                    id: "zona-1",
                    key: "z1",
                    zoneKeysCsv: "iniciacion",
                    texto: "",
                    notas: [],
                    subSubPrincipios: [
                      {
                        id: "ssp-1",
                        key: "ssp1",
                        numero: "1.1.1",
                        rol: "Central",
                        texto: "",
                        habilidades: [],
                        notas: [],
                      },
                    ],
                  },
                ],
                subSubPrincipios: [],
              },
            ],
          },
        ],
        setPieceRules: [],
        openIssues: [],
      },
    });

    const result = await gameModelService.getAdnOptions("team-1", "2026-2027");

    expect(mockGet).toHaveBeenCalledWith("/api/game-models", {
      params: { teamId: "team-1", season: "2026-2027" },
    });
    expect(result.subprincipios).toEqual([
      { id: "sub-1", numero: "1.1", titulo: "Presión alta", gameMomentName: "Fase defensiva" },
    ]);
    expect(result.subSubPrincipios).toEqual([
      { id: "ssp-1", numero: "1.1.1", rol: "Central", subprincipioId: "sub-1" },
    ]);
  });

  it("devuelve listas vacías (no un error) cuando el equipo no tiene GameModel todavía", async () => {
    mockGet.mockRejectedValue({ response: { status: 404 } });

    const result = await gameModelService.getAdnOptions("team-1", "2026-2027");

    expect(result).toEqual({ subprincipios: [], subSubPrincipios: [] });
  });

  it("propaga errores que no son 404", async () => {
    const error = { response: { status: 403 } };
    mockGet.mockRejectedValue(error);

    await expect(gameModelService.getAdnOptions("team-1", "2026-2027")).rejects.toBe(error);
  });
});
