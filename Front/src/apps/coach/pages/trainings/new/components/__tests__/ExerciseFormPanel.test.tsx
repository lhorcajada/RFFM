import type { ReactElement } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../../../../services/seasonPlanService", () => ({
  default: { getByTeamIdAndSeason: vi.fn() },
}));
vi.mock("../../../../../services/seasonService", () => ({
  default: { getActiveSeason: vi.fn() },
}));
vi.mock("../../../../../services/gameModelService", () => ({
  default: { getAdnOptions: vi.fn().mockResolvedValue({ subprincipios: [], subSubPrincipios: [] }) },
}));

import ExerciseFormPanel from "../ExerciseFormPanel";
import { emptyExercise } from "../../constants";
import type { ExerciseFormState } from "../../hooks/useExerciseForm";
import seasonPlanService from "../../../../../services/seasonPlanService";
import seasonService from "../../../../../services/seasonService";

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

function renderPanel(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("ExerciseFormPanel — vínculo directo con el modelo de juego (Amendment 2)", () => {
  it("renderiza la sección de relación con el modelo de juego (ModelRelationSection)", () => {
    renderPanel(<ExerciseFormPanel panelVisible form={buildFormState()} />);

    expect(screen.getByText(/relación con el modelo de juego/i)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /habilidades/i })).toBeInTheDocument();
  });
});

describe("ExerciseFormPanel — selector de tipo multi-selección", () => {
  it("renderiza un chip por cada tipo seleccionado en el select de Tipo", () => {
    renderPanel(
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
    renderPanel(
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
    renderPanel(
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

describe("ExerciseFormPanel — selector de Microciclo (SeasonPlan)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("no renderiza el selector de Microciclo cuando el equipo no tiene planificación de temporada", async () => {
    (seasonService.getActiveSeason as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "season-1" });
    (seasonPlanService.getByTeamIdAndSeason as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    renderPanel(<ExerciseFormPanel panelVisible form={buildFormState()} teamId="team-1" />);

    await waitFor(() => {
      expect(seasonPlanService.getByTeamIdAndSeason).toHaveBeenCalledWith("team-1", "season-1");
    });
    expect(screen.queryByRole("combobox", { name: /microciclo/i })).not.toBeInTheDocument();
  });

  it("renderiza el selector con las opciones del plan cuando existe una planificación", async () => {
    (seasonService.getActiveSeason as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "season-1" });
    (seasonPlanService.getByTeamIdAndSeason as ReturnType<typeof vi.fn>).mockResolvedValue({
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
                  objetivoSesionA: "A",
                  objetivoSesionB: "B",
                  exerciseCount: 0,
                },
              ],
            },
          ],
        },
      ],
    });

    renderPanel(<ExerciseFormPanel panelVisible form={buildFormState()} teamId="team-1" />);

    const select = await screen.findByRole("combobox", { name: /microciclo/i });
    await userEvent.click(select);
    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getByText(/Mesociclo 1.1 — Semana 1/)).toBeInTheDocument();
  });

  it("llama a setField con microcicloId al seleccionar una opción", async () => {
    (seasonService.getActiveSeason as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "season-1" });
    (seasonPlanService.getByTeamIdAndSeason as ReturnType<typeof vi.fn>).mockResolvedValue({
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
                  objetivoSesionA: "A",
                  objetivoSesionB: "B",
                  exerciseCount: 0,
                },
              ],
            },
          ],
        },
      ],
    });

    const setField = vi.fn();
    renderPanel(<ExerciseFormPanel panelVisible form={buildFormState({ setField })} teamId="team-1" />);

    const select = await screen.findByRole("combobox", { name: /microciclo/i });
    await userEvent.click(select);
    const listbox = screen.getByRole("listbox");
    await userEvent.click(within(listbox).getByText(/Mesociclo 1.1 — Semana 1/));

    expect(setField).toHaveBeenCalledWith("microcicloId", "micro-1");
  });
});
