import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ExerciseFormPanel from "../ExerciseFormPanel";
import { emptyExercise } from "../../constants";
import type { ExerciseFormState } from "../../hooks/useExerciseForm";

function buildFormState(overrides: Partial<ExerciseFormState> = {}): ExerciseFormState {
  return {
    form: { ...emptyExercise },
    setField: vi.fn(),
    setLevel: vi.fn(),
    toggleSkill: vi.fn(),
    skills: [],
    loadingSkills: false,
    saving: false,
    error: null,
    pendingFile: null,
    previewUrl: null,
    fileInputRef: { current: null },
    loadExercise: vi.fn(),
    loadExerciseAsCopy: vi.fn(),
    conditions: [],
    conditionInput: "",
    setConditionInput: vi.fn(),
    editingCondition: null,
    setEditingCondition: vi.fn(),
    savingCondition: false,
    savedExerciseId: null,
    handleFileChange: vi.fn(),
    handleRemoveMedia: vi.fn(),
    handleCancel: vi.fn(),
    handleSave: vi.fn(),
    handleAddCondition: vi.fn(),
    handleSaveEditCondition: vi.fn(),
    handleDeleteCondition: vi.fn(),
    isPhysical: false,
    isTechTac: true,
    ...overrides,
  } as ExerciseFormState;
}

describe("ExerciseFormPanel — selector de nivel", () => {
  it("no muestra el selector 'Vinculado a' cuando solo hay contexto de sub-subprincipio", () => {
    render(
      <ExerciseFormPanel
        panelVisible
        subSubPrincipleId="ssp-1"
        subSubPrincipleName="Habilidad X"
        subPrincipleId={null}
        subPrincipleName={null}
        form={buildFormState()}
      />
    );

    expect(screen.queryByRole("combobox", { name: /vinculado a/i })).not.toBeInTheDocument();
  });

  it("no muestra el selector 'Vinculado a' cuando solo hay contexto de subprincipio", () => {
    render(
      <ExerciseFormPanel
        panelVisible
        subSubPrincipleId={null}
        subSubPrincipleName={null}
        subPrincipleId="sp-1"
        subPrincipleName="Subprincipio Y"
        form={buildFormState()}
      />
    );

    expect(screen.queryByRole("combobox", { name: /vinculado a/i })).not.toBeInTheDocument();
  });

  it("muestra el selector 'Vinculado a' cuando hay ambos contextos y llama a setLevel al cambiar", async () => {
    const setLevel = vi.fn();
    render(
      <ExerciseFormPanel
        panelVisible
        subSubPrincipleId="ssp-1"
        subSubPrincipleName="Habilidad X"
        subPrincipleId="sp-1"
        subPrincipleName="Subprincipio Y"
        form={buildFormState({ setLevel })}
      />
    );

    const select = screen.getByRole("combobox", { name: /vinculado a/i });
    expect(select).toBeInTheDocument();

    await userEvent.click(select);
    const listbox = screen.getByRole("listbox");
    await userEvent.click(within(listbox).getByText(/Subprincipio: Subprincipio Y/));

    expect(setLevel).toHaveBeenCalledWith("subPrinciple");
  });
});
