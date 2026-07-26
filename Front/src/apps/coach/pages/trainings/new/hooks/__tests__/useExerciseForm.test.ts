import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useExerciseForm } from "../useExerciseForm";
import type { Exercise } from "../../../../../types/training";

vi.mock("../../../../../services/gameModelService", () => ({
  default: { getSubSubPrincipleSkills: vi.fn().mockResolvedValue([]) },
}));
vi.mock("../../../../../services/trainingService", () => ({
  default: {
    getExerciseById: vi.fn(), createExercise: vi.fn(), updateExercise: vi.fn(),
    uploadExerciseMedia: vi.fn(), createCondition: vi.fn(), updateCondition: vi.fn(), deleteCondition: vi.fn(),
  },
}));

const navigate = vi.fn();

describe("useExerciseForm — nivel inicial al crear (bug: no debe fijar ambos IDs)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("al crear desde un sub-subprincipio, el formulario inicial solo fija subSubPrincipleId, no subPrincipleId", async () => {
    const { result } = renderHook(() =>
      useExerciseForm({
        clubId: "club-1", subSubPrincipleId: "ssp-1", subPrincipleId: "sp-1", scenarioId: null,
        navigate, returnTo: "/coach/trainings",
      })
    );

    await waitFor(() => {
      expect(result.current.form.subSubPrincipleId).toBe("ssp-1");
      expect(result.current.form.subPrincipleId).toBeNull();
    });
  });

  it("al editar/duplicar un ejercicio ya vinculado a un sub-subprincipio, no reintroduce el subPrincipleId del padre", async () => {
    const { result } = renderHook(() =>
      useExerciseForm({
        clubId: "club-1", subSubPrincipleId: "ssp-1", subPrincipleId: "sp-1", scenarioId: null,
        navigate, returnTo: "/coach/trainings",
      })
    );

    const exercise: Exercise = {
      id: "ex-1", name: "Ejercicio", description: "", types: ["Tactical"],
      section: "Principal", durationTotal: 10, playersNumber: 8, goalPeekersNumber: 0,
      fieldSpace: "", skills: [], conditions: [],
      subSubPrincipleId: "ssp-1", subPrincipleId: null,
    };

    act(() => result.current.loadExercise(exercise));

    await waitFor(() => {
      expect(result.current.form.subSubPrincipleId).toBe("ssp-1");
      expect(result.current.form.subPrincipleId).toBeNull();
    });
  });
});

describe("useExerciseForm — reasignación de nivel (3 vías)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("setLevel('subPrinciple') limpia subSubPrincipleId y scenarioId, fija subPrincipleId", async () => {
    const { result } = renderHook(() =>
      useExerciseForm({
        clubId: "club-1", subSubPrincipleId: "ssp-1", subPrincipleId: "sp-1", scenarioId: null,
        navigate, returnTo: "/coach/trainings",
      })
    );

    act(() => result.current.setLevel("subPrinciple"));

    await waitFor(() => {
      expect(result.current.form.subPrincipleId).toBe("sp-1");
      expect(result.current.form.subSubPrincipleId).toBeNull();
      expect(result.current.form.scenarioId).toBeNull();
    });
  });

  it("setLevel('subSubPrinciple') limpia subPrincipleId y scenarioId, fija subSubPrincipleId", async () => {
    const { result } = renderHook(() =>
      useExerciseForm({
        clubId: "club-1", subSubPrincipleId: "ssp-1", subPrincipleId: "sp-1", scenarioId: null,
        navigate, returnTo: "/coach/trainings",
      })
    );

    act(() => result.current.setLevel("subPrinciple"));
    act(() => result.current.setLevel("subSubPrinciple"));

    await waitFor(() => {
      expect(result.current.form.subSubPrincipleId).toBe("ssp-1");
      expect(result.current.form.subPrincipleId).toBeNull();
      expect(result.current.form.scenarioId).toBeNull();
    });
  });

  it("setLevel('scenario') limpia subSubPrincipleId y subPrincipleId, fija scenarioId", async () => {
    const { result } = renderHook(() =>
      useExerciseForm({
        clubId: "club-1", subSubPrincipleId: "ssp-1", subPrincipleId: "sp-1", scenarioId: "scenario-1",
        navigate, returnTo: "/coach/trainings",
      })
    );

    act(() => result.current.setLevel("scenario"));

    await waitFor(() => {
      expect(result.current.form.scenarioId).toBe("scenario-1");
      expect(result.current.form.subPrincipleId).toBeNull();
      expect(result.current.form.subSubPrincipleId).toBeNull();
    });
  });

  it("setLevel('subPrinciple') y setLevel('scenario') limpian essentialSkillIds", async () => {
    const { result } = renderHook(() =>
      useExerciseForm({
        clubId: "club-1", subSubPrincipleId: "ssp-1", subPrincipleId: "sp-1", scenarioId: "scenario-1",
        navigate, returnTo: "/coach/trainings",
      })
    );

    act(() => result.current.toggleSkill("skill-1"));
    await waitFor(() => expect(result.current.form.essentialSkillIds).toEqual(["skill-1"]));

    act(() => result.current.setLevel("scenario"));

    await waitFor(() => expect(result.current.form.essentialSkillIds).toEqual([]));
  });

  it("al inicializar con scenarioId, resolveLevelIds prioriza subSubPrincipleId si está presente", async () => {
    const { result } = renderHook(() =>
      useExerciseForm({
        clubId: "club-1", subSubPrincipleId: "ssp-1", subPrincipleId: null, scenarioId: "scenario-1",
        navigate, returnTo: "/coach/trainings",
      })
    );

    await waitFor(() => {
      expect(result.current.form.subSubPrincipleId).toBe("ssp-1");
      expect(result.current.form.subPrincipleId).toBeNull();
      expect(result.current.form.scenarioId).toBeNull();
    });
  });

  it("al inicializar sin subSubPrincipleId pero con subPrincipleId, prioriza subPrincipleId sobre scenarioId", async () => {
    const { result } = renderHook(() =>
      useExerciseForm({
        clubId: "club-1", subSubPrincipleId: null, subPrincipleId: "sp-1", scenarioId: "scenario-1",
        navigate, returnTo: "/coach/trainings",
      })
    );

    await waitFor(() => {
      expect(result.current.form.subSubPrincipleId).toBeNull();
      expect(result.current.form.subPrincipleId).toBe("sp-1");
      expect(result.current.form.scenarioId).toBeNull();
    });
  });

  it("al inicializar solo con scenarioId, fija scenarioId", async () => {
    const { result } = renderHook(() =>
      useExerciseForm({
        clubId: "club-1", subSubPrincipleId: null, subPrincipleId: null, scenarioId: "scenario-1",
        navigate, returnTo: "/coach/trainings",
      })
    );

    await waitFor(() => {
      expect(result.current.form.subSubPrincipleId).toBeNull();
      expect(result.current.form.subPrincipleId).toBeNull();
      expect(result.current.form.scenarioId).toBe("scenario-1");
    });
  });
});

describe("useExerciseForm — multi-tipo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("isPhysical es true cuando el array types incluye Physical", async () => {
    const { result } = renderHook(() =>
      useExerciseForm({
        clubId: "club-1", subSubPrincipleId: null, subPrincipleId: null,
        navigate, returnTo: "/coach/trainings",
      })
    );

    act(() => result.current.setField("types", ["Physical", "Technical"]));

    await waitFor(() => {
      expect(result.current.isPhysical).toBe(true);
      expect(result.current.isTechTac).toBe(true);
    });
  });

  it("isPhysical y isTechTac son ambos true cuando se seleccionan Physical y Tactical juntos (no son excluyentes)", async () => {
    const { result } = renderHook(() =>
      useExerciseForm({
        clubId: "club-1", subSubPrincipleId: null, subPrincipleId: null,
        navigate, returnTo: "/coach/trainings",
      })
    );

    act(() => result.current.setField("types", ["Physical", "Tactical"]));

    await waitFor(() => {
      expect(result.current.isPhysical).toBe(true);
      expect(result.current.isTechTac).toBe(true);
    });
  });

  it("bloquea el guardado con un mensaje de error cuando no hay ningún tipo seleccionado", async () => {
    const trainingService = (await import("../../../../../services/trainingService")).default;
    const { result } = renderHook(() =>
      useExerciseForm({
        clubId: "club-1", subSubPrincipleId: null, subPrincipleId: null,
        navigate, returnTo: "/coach/trainings",
      })
    );

    act(() => result.current.setField("types", []));
    act(() => result.current.setField("name", "Ejercicio sin tipo"));

    await act(async () => {
      await result.current.handleSave();
    });

    expect(result.current.error).toMatch(/tipo/i);
    expect(trainingService.createExercise).not.toHaveBeenCalled();
  });
});
