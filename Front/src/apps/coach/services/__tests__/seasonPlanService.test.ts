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

const mockGetGameModelByTeamIdAndSeason = vi.fn();

vi.mock("../gameModelService", () => ({
  default: {
    getByTeamIdAndSeason: (...args: unknown[]) => mockGetGameModelByTeamIdAndSeason(...args),
  },
}));

import seasonPlanService from "../seasonPlanService";
import type { SeasonPlan } from "../../types/seasonPlan";

function microcicloAdnFields() {
  return {
    sesionASubprincipioIds: [],
    sesionASubSubPrincipioIds: [],
    sesionAHabilidades: [],
    sesionBSubprincipioIds: [],
    sesionBSubSubPrincipioIds: [],
    sesionBHabilidades: [],
  };
}

describe("seasonPlanService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getByTeamIdAndSeason", () => {
    it("maps the nested API response into a SeasonPlan with client-side ids", async () => {
      mockGet.mockResolvedValue({
        data: {
          id: "plan-1",
          teamId: "team-1",
          seasonId: "season-1",
          macrociclos: [
            {
              id: "macro-1",
              order: 1,
              name: "Macrociclo 1",
              startDate: "2026-09-01",
              endDate: "2026-11-30",
              mesociclos: [
                {
                  id: "meso-1",
                  order: 1,
                  name: "Mesociclo 1.1 — Creación Propia",
                  startDate: "2026-09-01",
                  endDate: "2026-09-21",
                  gameZoneId: 2,
                  microciclos: [
                    {
                      id: "micro-1",
                      order: 1,
                      weekLabel: "Semana 1 — Analítico",
                      startDate: "2026-09-01",
                      endDate: "2026-09-07",
                      objetivoSesionA: "Objetivo A",
                      objetivoSesionB: "Objetivo B",
                      exerciseCount: 0,
                      sesionASubprincipios: [
                        { id: "sub-1", numero: "1.1", titulo: "Defensa organizada 1.1", gameMomentName: "Fase defensiva" },
                      ],
                      sesionASubSubPrincipios: [{ id: "ssp-1", numero: "1.1.1", rol: "Central" }],
                      sesionAHabilidades: ["Perfilamiento"],
                      sesionBSubprincipios: [],
                      sesionBSubSubPrincipios: [],
                      sesionBHabilidades: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      });

      const result = await seasonPlanService.getByTeamIdAndSeason("team-1", "season-1");

      expect(mockGet).toHaveBeenCalledWith("/api/season-plans", {
        params: { teamId: "team-1", seasonId: "season-1" },
      });
      expect(result?.id).toBe("plan-1");
      expect(result?.macrociclos[0].apiId).toBe("macro-1");
      expect(result?.macrociclos[0].mesociclos[0].apiId).toBe("meso-1");
      expect(result?.macrociclos[0].mesociclos[0].gameZoneId).toBe(2);
      const microciclo = result?.macrociclos[0].mesociclos[0].microciclos[0];
      expect(microciclo?.apiId).toBe("micro-1");
      expect(microciclo?.exerciseCount).toBe(0);
      expect(microciclo?.sesionASubprincipios).toEqual([
        { id: "sub-1", numero: "1.1", titulo: "Defensa organizada 1.1", gameMomentName: "Fase defensiva" },
      ]);
      expect(microciclo?.sesionASubSubPrincipios).toEqual([{ id: "ssp-1", numero: "1.1.1", rol: "Central" }]);
      expect(microciclo?.sesionAHabilidades).toEqual(["Perfilamiento"]);
      expect(microciclo?.sesionASubprincipioIds).toEqual(["sub-1"]);
      expect(microciclo?.sesionASubSubPrincipioIds).toEqual(["ssp-1"]);
      expect(microciclo?.sesionBSubprincipios).toEqual([]);
      expect(microciclo?.sesionBSubprincipioIds).toEqual([]);
    });

    it("returns null when the API responds 404 (no plan yet for this team/season)", async () => {
      mockGet.mockRejectedValue({ response: { status: 404 } });

      const result = await seasonPlanService.getByTeamIdAndSeason("team-1", "season-1");

      expect(result).toBeNull();
    });

    it("propagates non-404 errors", async () => {
      const error = { response: { status: 403 } };
      mockGet.mockRejectedValue(error);

      await expect(seasonPlanService.getByTeamIdAndSeason("team-1", "season-1")).rejects.toBe(error);
    });
  });

  describe("create", () => {
    it("POSTs a nested request built from the draft and returns the draft with the new id", async () => {
      mockPost.mockResolvedValue({ data: { id: "plan-new" } });

      const draft: SeasonPlan = {
        id: "",
        teamId: "team-1",
        seasonId: "season-1",
        macrociclos: [
          {
            id: -1,
            order: 1,
            name: "Macrociclo 1",
            startDate: "2026-09-01",
            endDate: "2026-11-30",
            mesociclos: [
              {
                id: -2,
                order: 1,
                name: "Mesociclo 1.1",
                startDate: "2026-09-01",
                endDate: "2026-09-21",
                gameZoneId: 2,
                microciclos: [
                  {
                    id: -3,
                    order: 1,
                    weekLabel: "Semana 1",
                    startDate: "2026-09-01",
                    endDate: "2026-09-07",
                    objetivoSesionA: "A",
                    objetivoSesionB: "B",
                    exerciseCount: 0,
                    ...microcicloAdnFields(),
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = await seasonPlanService.create(draft);

      expect(mockPost).toHaveBeenCalledWith("/api/season-plans", {
        teamId: "team-1",
        seasonId: "season-1",
        macrociclos: [
          {
            order: 1,
            name: "Macrociclo 1",
            startDate: "2026-09-01",
            endDate: "2026-11-30",
            mesociclos: [
              {
                order: 1,
                name: "Mesociclo 1.1",
                startDate: "2026-09-01",
                endDate: "2026-09-21",
                gameZoneId: 2,
                microciclos: [
                  {
                    order: 1,
                    weekLabel: "Semana 1",
                    startDate: "2026-09-01",
                    endDate: "2026-09-07",
                    objetivoSesionA: "A",
                    objetivoSesionB: "B",
                    ...microcicloAdnFields(),
                  },
                ],
              },
            ],
          },
        ],
      });
      expect(result.id).toBe("plan-new");
    });

    it("incluye los enlaces ADN seleccionados por sesión en el request", async () => {
      mockPost.mockResolvedValue({ data: { id: "plan-new" } });

      const draft: SeasonPlan = {
        id: "",
        teamId: "team-1",
        seasonId: "season-1",
        macrociclos: [
          {
            id: -1,
            order: 1,
            name: "Macrociclo 1",
            startDate: "2026-09-01",
            endDate: "2026-11-30",
            mesociclos: [
              {
                id: -2,
                order: 1,
                name: "Mesociclo 1.1",
                startDate: "2026-09-01",
                endDate: "2026-09-21",
                gameZoneId: 2,
                microciclos: [
                  {
                    id: -3,
                    order: 1,
                    weekLabel: "Semana 1",
                    startDate: "2026-09-01",
                    endDate: "2026-09-07",
                    objetivoSesionA: "A",
                    objetivoSesionB: "B",
                    exerciseCount: 0,
                    sesionASubprincipioIds: ["sub-1"],
                    sesionASubSubPrincipioIds: ["ssp-1"],
                    sesionAHabilidades: ["Perfilamiento"],
                    sesionBSubprincipioIds: [],
                    sesionBSubSubPrincipioIds: [],
                    sesionBHabilidades: [],
                    sesionASubprincipios: [],
                    sesionASubSubPrincipios: [],
                    sesionBSubprincipios: [],
                    sesionBSubSubPrincipios: [],
                  },
                ],
              },
            ],
          },
        ],
      };

      await seasonPlanService.create(draft);

      const requestBody = mockPost.mock.calls[0][1];
      const microcicloRequest = requestBody.macrociclos[0].mesociclos[0].microciclos[0];
      expect(microcicloRequest.sesionASubprincipioIds).toEqual(["sub-1"]);
      expect(microcicloRequest.sesionASubSubPrincipioIds).toEqual(["ssp-1"]);
      expect(microcicloRequest.sesionAHabilidades).toEqual(["Perfilamiento"]);
      expect(microcicloRequest.sesionBSubprincipioIds).toEqual([]);
    });
  });

  describe("update", () => {
    it("PUTs the nested request (with apiId per node) against the plan's id", async () => {
      mockPut.mockResolvedValue({});

      const draft: SeasonPlan = {
        id: "plan-1",
        teamId: "team-1",
        seasonId: "season-1",
        macrociclos: [
          {
            id: 1,
            apiId: "macro-1",
            order: 1,
            name: "Macrociclo 1",
            startDate: "2026-09-01",
            endDate: "2026-11-30",
            mesociclos: [],
          },
        ],
      };

      await seasonPlanService.update(draft);

      expect(mockPut).toHaveBeenCalledWith("/api/season-plans/plan-1", {
        macrociclos: [
          {
            id: "macro-1",
            name: "Macrociclo 1",
            startDate: "2026-09-01",
            endDate: "2026-11-30",
            mesociclos: [],
          },
        ],
      });
    });
  });

  describe("delete", () => {
    it("DELETEs the plan by id", async () => {
      mockDelete.mockResolvedValue({});

      await seasonPlanService.remove("plan-1");

      expect(mockDelete).toHaveBeenCalledWith("/api/season-plans/plan-1");
    });
  });

  describe("getAdnOptions", () => {
    it("aplana el GameModel del equipo en listas de Subprincipio y SubSubPrincipio", async () => {
      mockGetGameModelByTeamIdAndSeason.mockResolvedValue({
        id: "model-1",
        teamId: "team-1",
        name: "Modelo",
        season: "2026-2027",
        principles: [
          {
            id: 1,
            apiId: "principle-1",
            gameMomentId: 1,
            gameMomentName: "Fase defensiva",
            numero: 1,
            titulo: "Defensa organizada",
            texto: "",
            notas: [],
            subprincipios: [
              {
                id: 2,
                apiId: "sub-1",
                numero: "1.1",
                titulo: "Presión alta",
                texto: "",
                notas: [],
                zonas: [
                  {
                    id: 3,
                    apiId: "zona-1",
                    zoneKeys: ["iniciacion"],
                    texto: "",
                    notas: [],
                    subSubPrincipios: [
                      { id: 4, apiId: "ssp-1", numero: "1.1.1", rol: "Central", texto: "", habilidades: [], notas: [] },
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
      });

      const result = await seasonPlanService.getAdnOptions("team-1", "2026-2027");

      expect(mockGetGameModelByTeamIdAndSeason).toHaveBeenCalledWith("team-1", "2026-2027");
      expect(result.subprincipios).toEqual([
        { id: "sub-1", numero: "1.1", titulo: "Presión alta", gameMomentName: "Fase defensiva" },
      ]);
      expect(result.subSubPrincipios).toEqual([
        { id: "ssp-1", numero: "1.1.1", rol: "Central", subprincipioId: "sub-1" },
      ]);
    });

    it("devuelve listas vacías (no un error) cuando el equipo no tiene GameModel todavía", async () => {
      mockGetGameModelByTeamIdAndSeason.mockRejectedValue({ response: { status: 404 } });

      const result = await seasonPlanService.getAdnOptions("team-1", "2026-2027");

      expect(result).toEqual({ subprincipios: [], subSubPrincipios: [] });
    });

    it("propaga errores que no son 404", async () => {
      const error = { response: { status: 403 } };
      mockGetGameModelByTeamIdAndSeason.mockRejectedValue(error);

      await expect(seasonPlanService.getAdnOptions("team-1", "2026-2027")).rejects.toBe(error);
    });
  });
});
