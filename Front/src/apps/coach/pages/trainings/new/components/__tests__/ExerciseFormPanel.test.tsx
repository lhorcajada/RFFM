import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../../services/gameModelService", () => ({
  default: { getAdnOptions: vi.fn().mockResolvedValue({ subprincipios: [], subSubPrincipios: [] }) },
}));
vi.mock("../../../../../services/seasonService", () => ({
  default: { getActiveSeason: vi.fn().mockResolvedValue({ id: "season-1" }) },
}));

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
    savedExerciseId: null,
    handleFileChange: vi.fn(),
    handleRemoveMedia: vi.fn(),
    handleCancel: vi.fn(),
    handleSave: vi.fn(),
    ...overrides,
  } as ExerciseFormState;
}

function renderPanel(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("ExerciseFormPanel — campos del template reducido", () => {
  it("renderiza Título, Tipo, Objetivo, Objetivo por rol, Logística, Duración, Porteros, Dibujo y Descripción", () => {
    renderPanel(<ExerciseFormPanel panelVisible form={buildFormState()} />);

    expect(screen.getByLabelText("Título")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /tipo/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Objetivo")).toBeInTheDocument();
    expect(screen.getByLabelText(/objetivo por rol/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Logística")).toBeInTheDocument();
    expect(screen.getByLabelText(/duración/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/porteros/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/dibujo/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Descripción")).toBeInTheDocument();
  });

  it("renderiza la sección de relación con el modelo de juego", () => {
    renderPanel(<ExerciseFormPanel panelVisible form={buildFormState()} />);

    expect(screen.getByText(/relación con el modelo de juego/i)).toBeInTheDocument();
  });

  it("renderiza el editor de Niveles", () => {
    renderPanel(<ExerciseFormPanel panelVisible form={buildFormState()} />);

    expect(screen.getByText(/niveles/i)).toBeInTheDocument();
  });

  it("no renderiza ninguna sección de Condiciones (eliminada — pasa a formar parte de la Descripción)", () => {
    renderPanel(<ExerciseFormPanel panelVisible form={buildFormState()} />);

    expect(screen.queryByText(/condiciones/i)).not.toBeInTheDocument();
  });

  it("llama a setField con el tipo elegido al cambiar el selector de Tipo", async () => {
    const setField = vi.fn();
    const { default: userEvent } = await import("@testing-library/user-event");
    renderPanel(<ExerciseFormPanel panelVisible form={buildFormState({ setField })} />);

    const select = screen.getByRole("combobox", { name: /tipo/i });
    await userEvent.click(select);
    const listbox = screen.getByRole("listbox");
    await userEvent.click((await screen.findAllByText("Global"))[0]);

    expect(setField).toHaveBeenCalledWith("tipo", "Global");
    void listbox;
  });
});
