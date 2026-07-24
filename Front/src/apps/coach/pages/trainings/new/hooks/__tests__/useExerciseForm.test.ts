import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useExerciseForm } from "../useExerciseForm";

vi.mock("../../../../services/gameModelService", () => ({
  default: { getSubSubPrincipleSkills: vi.fn().mockResolvedValue([]) },
}));
vi.mock("../../../../services/trainingService", () => ({
  default: {
    getExerciseById: vi.fn(), createExercise: vi.fn(), updateExercise: vi.fn(),
    uploadExerciseMedia: vi.fn(), createCondition: vi.fn(), updateCondition: vi.fn(), deleteCondition: vi.fn(),
  },
}));

const navigate = vi.fn();

describe("useExerciseForm — reasignación de nivel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("setLevel('subPrinciple') limpia subSubPrincipleId y fija subPrincipleId", async () => {
    const { result } = renderHook(() =>
      useExerciseForm({
        clubId: "club-1", subSubPrincipleId: "ssp-1", subPrincipleId: "sp-1",
        navigate, returnTo: "/coach/trainings",
      })
    );

    act(() => result.current.setLevel("subPrinciple"));

    await waitFor(() => {
      expect(result.current.form.subPrincipleId).toBe("sp-1");
      expect(result.current.form.subSubPrincipleId).toBeNull();
    });
  });

  it("setLevel('subSubPrinciple') limpia subPrincipleId y fija subSubPrincipleId", async () => {
    const { result } = renderHook(() =>
      useExerciseForm({
        clubId: "club-1", subSubPrincipleId: "ssp-1", subPrincipleId: "sp-1",
        navigate, returnTo: "/coach/trainings",
      })
    );

    act(() => result.current.setLevel("subPrinciple"));
    act(() => result.current.setLevel("subSubPrinciple"));

    await waitFor(() => {
      expect(result.current.form.subSubPrincipleId).toBe("ssp-1");
      expect(result.current.form.subPrincipleId).toBeNull();
    });
  });

  it("setLevel('subPrinciple') vacía essentialSkillIds porque no aplican a ese nivel", async () => {
    const { result } = renderHook(() =>
      useExerciseForm({
        clubId: "club-1", subSubPrincipleId: "ssp-1", subPrincipleId: "sp-1",
        navigate, returnTo: "/coach/trainings",
      })
    );

    act(() => result.current.toggleSkill("skill-1"));
    await waitFor(() => expect(result.current.form.essentialSkillIds).toEqual(["skill-1"]));

    act(() => result.current.setLevel("subPrinciple"));

    await waitFor(() => expect(result.current.form.essentialSkillIds).toEqual([]));
  });
});
