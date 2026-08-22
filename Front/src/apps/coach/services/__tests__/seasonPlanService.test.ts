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

const mockGetAdnOptions = vi.fn();

vi.mock("../gameModelService", () => ({
  default: {
    getAdnOptions: (...args: unknown[]) => mockGetAdnOptions(...args),
  },
}));

import seasonPlanService from "../seasonPlanService";
import type { SeasonPlan } from "../../types/seasonPlan";

describe("seasonPlanService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getByTeamIdAndSeason", () => {
    it("maps the nested API response into a SeasonPlan with client-side ids and Sessions per Microciclo", async () => {
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
                      sessions: [
                        {
                          id: "sess-1",
                          name: "Sesión 1",
                          objetivoGeneral: "Objetivo general",
                          date: "2026-09-02",
                          exerciseCount: 3,
                        },
                      ],
                      subprincipiosObjetivo: [
                        { id: "sub-1", numero: "1.1", titulo: "Defensa organizada", gameMomentName: "Fase defensiva" },
                      ],
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
      expect(microciclo?.sessions).toEqual([
        { id: "sess-1", name: "Sesión 1", objetivoGeneral: "Objetivo general", date: "2026-09-02", exerciseCount: 3 },
      ]);
      expect(microciclo?.subprincipiosObjetivo).toEqual([
        { id: "sub-1", numero: "1.1", titulo: "Defensa organizada", gameMomentName: "Fase defensiva" },
      ]);
      expect(microciclo?.subprincipioObjetivoIds).toEqual(["sub-1"]);
    });

    it("maps an empty sessions array when the Microciclo has no linked sessions", async () => {
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
                  name: "Mesociclo 1.1",
                  startDate: "2026-09-01",
                  endDate: "2026-09-21",
                  gameZoneId: 2,
                  microciclos: [
                    {
                      id: "micro-1",
                      order: 1,
                      weekLabel: "Semana 1",
                      startDate: "2026-09-01",
                      endDate: "2026-09-07",
                      sessions: [],
                      subprincipiosObjetivo: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      });

      const result = await seasonPlanService.getByTeamIdAndSeason("team-1", "season-1");
      const microciclo = result?.macrociclos[0].mesociclos[0].microciclos[0];
      expect(microciclo?.sessions).toEqual([]);
      expect(microciclo?.subprincipiosObjetivo).toEqual([]);
      expect(microciclo?.subprincipioObjetivoIds).toEqual([]);
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
    it("POSTs a nested request built from the draft (Microciclo without ADN/session fields) and returns the draft with the new id", async () => {
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
                    sessions: [],
                    subprincipiosObjetivo: [],
                    subprincipioObjetivoIds: ["sub-1", "sub-2"],
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
                    subprincipioObjetivoIds: ["sub-1", "sub-2"],
                  },
                ],
              },
            ],
          },
        ],
      });
      expect(result.id).toBe("plan-new");
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

    it("incluye subprincipioObjetivoIds por Microciclo en el payload de guardado", async () => {
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
            mesociclos: [
              {
                id: 2,
                apiId: "meso-1",
                order: 1,
                name: "Mesociclo 1.1",
                startDate: "2026-09-01",
                endDate: "2026-09-21",
                gameZoneId: 2,
                microciclos: [
                  {
                    id: 3,
                    apiId: "micro-1",
                    order: 1,
                    weekLabel: "Semana 1",
                    startDate: "2026-09-01",
                    endDate: "2026-09-07",
                    sessions: [],
                    subprincipiosObjetivo: [],
                    subprincipioObjetivoIds: ["sub-1"],
                  },
                ],
              },
            ],
          },
        ],
      };

      await seasonPlanService.update(draft);

      const requestBody = mockPut.mock.calls[0][1];
      const microcicloRequest = requestBody.macrociclos[0].mesociclos[0].microciclos[0];
      expect(microcicloRequest.subprincipioObjetivoIds).toEqual(["sub-1"]);
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
    it("delega en gameModelService.getAdnOptions con teamId y season", async () => {
      const options = {
        subprincipios: [{ id: "sub-1", numero: "1.1", titulo: "Presión alta", gameMomentName: "Fase defensiva" }],
        subSubPrincipios: [{ id: "ssp-1", numero: "1.1.1", rol: "Central", subprincipioId: "sub-1" }],
      };
      mockGetAdnOptions.mockResolvedValue(options);

      const result = await seasonPlanService.getAdnOptions("team-1", "2026-2027");

      expect(mockGetAdnOptions).toHaveBeenCalledWith("team-1", "2026-2027");
      expect(result).toEqual(options);
    });

    it("propaga el resultado (listas vacías incluidas) tal cual lo devuelve gameModelService", async () => {
      mockGetAdnOptions.mockResolvedValue({ subprincipios: [], subSubPrincipios: [] });

      const result = await seasonPlanService.getAdnOptions("team-1", "2026-2027");

      expect(result).toEqual({ subprincipios: [], subSubPrincipios: [] });
    });

    it("propaga errores lanzados por gameModelService.getAdnOptions", async () => {
      const error = { response: { status: 403 } };
      mockGetAdnOptions.mockRejectedValue(error);

      await expect(seasonPlanService.getAdnOptions("team-1", "2026-2027")).rejects.toBe(error);
    });
  });
});
