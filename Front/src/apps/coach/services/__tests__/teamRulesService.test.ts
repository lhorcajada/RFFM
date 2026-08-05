import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGet = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

vi.mock("../../../../core/api/client", () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    put: (...args: unknown[]) => mockPut(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

import teamRulesService from "../teamRulesService";

describe("teamRulesService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getTeamRules", () => {
    it("returns the rules set when the API responds 200 with a payload", async () => {
      const dto = {
        teamId: "team-1",
        title: "NORMAS DE EQUIPO",
        subtitle: "Compromiso, respeto y equipo",
        introNote: "Nota inicial",
        closingNote: null,
        applicationNote: null,
        rules: [
          {
            id: "rule-1",
            order: 1,
            shortTitle: "Asistencia y preparación",
            highlight: "Entrenar suma preparación...",
            violationSummary: "No entrenar",
            consequenceSummary: "Podrá afectar",
            longDescription: null,
            bulletPoints: null,
            consequenceDetail: null,
          },
        ],
        updatedAt: "2026-01-01T00:00:00Z",
      };
      mockGet.mockResolvedValue({ status: 200, data: dto });

      const result = await teamRulesService.getTeamRules("team-1");

      expect(mockGet).toHaveBeenCalledWith("/api/coaches/teams/team-1/rules");
      expect(result).toEqual(dto);
    });

    it("returns null when the API responds 204 (no rules yet)", async () => {
      mockGet.mockResolvedValue({ status: 204, data: "" });

      const result = await teamRulesService.getTeamRules("team-1");

      expect(result).toBeNull();
    });

    it("propagates errors from the API (e.g. 404 team not found)", async () => {
      const error = { response: { status: 404 } };
      mockGet.mockRejectedValue(error);

      await expect(teamRulesService.getTeamRules("missing-team")).rejects.toBe(error);
    });
  });

  describe("saveTeamRules", () => {
    it("PUTs the command body against the team's rules endpoint and returns the saved DTO", async () => {
      const command = {
        title: "NORMAS DE EQUIPO",
        subtitle: "Compromiso, respeto y equipo",
        introNote: "Nota inicial",
        closingNote: null,
        applicationNote: null,
        rules: [
          {
            shortTitle: "Puntualidad",
            highlight: null,
            violationSummary: "Llegar tarde",
            consequenceSummary: "Aportar 1€",
            longDescription: null,
            bulletPoints: null,
            consequenceDetail: null,
          },
        ],
      };
      const savedDto = { ...command, teamId: "team-1", rules: [{ ...command.rules[0], id: "rule-1", order: 1 }], updatedAt: "2026-01-01T00:00:00Z" };
      mockPut.mockResolvedValue({ status: 200, data: savedDto });

      const result = await teamRulesService.saveTeamRules("team-1", command);

      expect(mockPut).toHaveBeenCalledWith("/api/coaches/teams/team-1/rules", command);
      expect(result).toEqual(savedDto);
    });

    it("propagates validation errors from the API", async () => {
      const error = { response: { status: 400, data: { errors: { Title: ["required"] } } } };
      mockPut.mockRejectedValue(error);

      await expect(
        teamRulesService.saveTeamRules("team-1", {
          title: "",
          subtitle: "",
          introNote: "",
          closingNote: null,
          applicationNote: null,
          rules: [],
        })
      ).rejects.toBe(error);
    });
  });

  describe("deleteTeamRules", () => {
    it("DELETEs the team's rules endpoint", async () => {
      mockDelete.mockResolvedValue({ status: 204 });

      await teamRulesService.deleteTeamRules("team-1");

      expect(mockDelete).toHaveBeenCalledWith("/api/coaches/teams/team-1/rules");
    });

    it("propagates errors from the API", async () => {
      const error = { response: { status: 403 } };
      mockDelete.mockRejectedValue(error);

      await expect(teamRulesService.deleteTeamRules("team-1")).rejects.toBe(error);
    });
  });
});
