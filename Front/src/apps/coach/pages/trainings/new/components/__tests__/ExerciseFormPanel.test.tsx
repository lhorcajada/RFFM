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

describe("ExerciseFormPanel — sin campos de vinculación al modelo de juego", () => {
  it("no renderiza ningún selector 'Vinculado a' ni campo de habilidades asociadas", () => {
    render(<ExerciseFormPanel panelVisible form={buildFormState()} />);

    expect(screen.queryByRole("combobox", { name: /vinculado a/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/habilidades asociadas/i)).not.toBeInTheDocument();
  });
});

describe("ExerciseFormPanel — selector de tipo multi-selección", () => {
  it("renderiza un chip por cada tipo seleccionado en el select de Tipo", () => {
    render(
      <ExerciseFormPanel
        panelVisible
        form={buildFormState({ form: { ...emptyExercise, types: ["Physical", "Game"] } })}
      />
    );

    const select = screen.getByRole("combobox", { name: /tipo/i });
    expect(within(select).getByText("Fisico")).toBeInTheDocument();
    expect(within(select).getByText("Juego")).toBeInTheDocument();
  });

  it("muestra ambos bloques de campos (Series y Toques) cuando isPhysical e isTechTac son true a la vez", () => {
    render(
      <ExerciseFormPanel
        panelVisible
        form={buildFormState({
          form: { ...emptyExercise, types: ["Physical", "Technical"] },
          isPhysical: true,
          isTechTac: true,
        })}
      />
    );

    expect(screen.getByLabelText("Series")).toBeInTheDocument();
    expect(screen.getByLabelText("Toques")).toBeInTheDocument();
  });

  it("llama a setField con el nuevo array de tipos al seleccionar una opción", async () => {
    const setField = vi.fn();
    render(
      <ExerciseFormPanel
        panelVisible
        form={buildFormState({ form: { ...emptyExercise, types: ["Tactical"] }, setField })}
      />
    );

    const select = screen.getByRole("combobox", { name: /tipo/i });
    await userEvent.click(select);
    const listbox = screen.getByRole("listbox");
    await userEvent.click(within(listbox).getByText("Cognitivo"));

    expect(setField).toHaveBeenCalledWith("types", ["Tactical", "Cognitive"]);
  });
});
