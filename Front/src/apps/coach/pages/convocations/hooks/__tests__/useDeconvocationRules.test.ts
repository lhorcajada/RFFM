import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

vi.mock("../../../../services/deconvocationRulesService", () => ({
  getDeconvocationRules: vi.fn(),
}));

import { getDeconvocationRules } from "../../../../services/deconvocationRulesService";
import { useDeconvocationRules } from "../useDeconvocationRules";
import { DEFAULT_RULES } from "../../utils/rules/defaultRules";

const mockGet = getDeconvocationRules as ReturnType<typeof vi.fn>;
const custom = [{ condition: "injuryRest" as const, text: "Mi descanso", points: { window: 2 }, weights: {} }];

describe("useDeconvocationRules", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("usa las reglas por defecto mientras carga", () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useDeconvocationRules("t1"));
    expect(result.current.rules).toBe(DEFAULT_RULES);
  });

  it("usa las reglas por defecto si el equipo no tiene configuración", async () => {
    mockGet.mockResolvedValue({ rules: null, isDefault: true });
    const { result } = renderHook(() => useDeconvocationRules("t1"));
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith("t1"));
    expect(result.current.rules).toBe(DEFAULT_RULES);
  });

  it("devuelve las reglas guardadas del equipo", async () => {
    mockGet.mockResolvedValue({ rules: custom, isDefault: false });
    const { result } = renderHook(() => useDeconvocationRules("t1"));
    await waitFor(() => expect(result.current.rules).toEqual(custom));
  });

  it("migra una configuración antigua con reglas de puntos", async () => {
    mockGet.mockResolvedValue({
      rules: [{ condition: "goals", text: "Goles", points: { perGoal: 5 }, weights: {} }],
      isDefault: false,
    });
    const { result } = renderHook(() => useDeconvocationRules("t1"));
    await waitFor(() => expect(result.current.rules.map((r) => r.condition)).toEqual(["injuryRest", "otherDeconvocation", "rivalDifficulty"]));
  });

  it("usa las reglas por defecto si la lectura falla", async () => {
    mockGet.mockRejectedValue(new Error("403"));
    const { result } = renderHook(() => useDeconvocationRules("t1"));
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(result.current.rules).toBe(DEFAULT_RULES);
  });

  it("reload vuelve a leer la configuración vigente", async () => {
    mockGet.mockResolvedValueOnce({ rules: null, isDefault: true });
    const { result } = renderHook(() => useDeconvocationRules("t1"));
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));

    mockGet.mockResolvedValueOnce({ rules: custom, isDefault: false });
    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.rules).toEqual(custom);
  });

  it("no consulta nada sin equipo", () => {
    renderHook(() => useDeconvocationRules(""));
    expect(mockGet).not.toHaveBeenCalled();
  });
});
