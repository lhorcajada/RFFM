import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../core/api/client", () => ({
  __esModule: true,
  default: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import client from "../../../../core/api/client";
import {
  getDeconvocationRules,
  resetDeconvocationRules,
  saveDeconvocationRules,
} from "../deconvocationRulesService";
import type { DeconvocationRuleConfig } from "../../pages/convocations/utils/rules/ruleCatalog";

const rules: DeconvocationRuleConfig[] = [{ condition: "goals", text: "Goles", points: { perGoal: 3 }, weights: {} }];

describe("deconvocationRulesService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("lee las reglas del equipo", async () => {
    (client.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { rules, isDefault: false } });

    const result = await getDeconvocationRules("t 1");

    expect(client.get).toHaveBeenCalledWith("/api/teams/t%201/deconvocation-rules");
    expect(result).toEqual({ rules, isDefault: false });
  });

  it("guarda las reglas del equipo", async () => {
    (client.put as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { rules, isDefault: false } });

    const result = await saveDeconvocationRules("t1", rules);

    expect(client.put).toHaveBeenCalledWith("/api/teams/t1/deconvocation-rules", { rules });
    expect(result.rules).toEqual(rules);
  });

  it("restablece las reglas por defecto", async () => {
    (client.delete as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await resetDeconvocationRules("t1");

    expect(client.delete).toHaveBeenCalledWith("/api/teams/t1/deconvocation-rules");
  });
});
