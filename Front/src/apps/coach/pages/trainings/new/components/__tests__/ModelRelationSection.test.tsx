import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../../../../services/gameModelService", () => ({
  default: { getAdnOptions: vi.fn() },
}));
vi.mock("../../../../../services/seasonService", () => ({
  default: { getActiveSeason: vi.fn() },
}));

import ModelRelationSection from "../ModelRelationSection";
import gameModelService from "../../../../../services/gameModelService";
import seasonService from "../../../../../services/seasonService";
import type { ExerciseModelRelationRequest } from "../../../../../types/training";

const adnOptionsWithData = {
  subprincipios: [
    { id: "sub-1", numero: "1.1", titulo: "Presión alta", gameMomentName: "Fase defensiva" },
  ],
  subSubPrincipios: [{ id: "ssp-1", numero: "1.1.1", rol: "Central", subprincipioId: "sub-1" }],
};

const emptyAdnOptions = { subprincipios: [], subSubPrincipios: [] };

function setup(
  overrides: Partial<{
    modelRelations: ExerciseModelRelationRequest[];
    onChange: (relations: ExerciseModelRelationRequest[]) => void;
    teamId?: string;
  }> = {}
) {
  const onChange = overrides.onChange ?? vi.fn();
  render(
    <MemoryRouter>
      <ModelRelationSection
        modelRelations={overrides.modelRelations ?? []}
        onChange={onChange}
        teamId={overrides.teamId ?? "team-1"}
      />
    </MemoryRouter>
  );
  return { onChange };
}

describe("ModelRelationSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (seasonService.getActiveSeason as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "season-1",
      name: "2026-2027",
    });
  });

  it("carga las opciones ADN del GameModel del equipo vía gameModelService.getAdnOptions", async () => {
    (gameModelService.getAdnOptions as ReturnType<typeof vi.fn>).mockResolvedValue(adnOptionsWithData);

    setup({
      modelRelations: [{ subprincipioId: "sub-1", isFoco: true, habilidadesImprescindibles: [], items: [] }],
    });

    await waitFor(() => {
      expect(gameModelService.getAdnOptions).toHaveBeenCalledWith("team-1", "2026-2027");
    });

    const combobox = await screen.findByRole("combobox", { name: /subprincipio/i });
    expect(combobox).toHaveValue("1.1 · Presión alta");
  });

  it("muestra el estado vacío (mensaje + selector deshabilitado) cuando el equipo no tiene GameModel", async () => {
    (gameModelService.getAdnOptions as ReturnType<typeof vi.fn>).mockResolvedValue(emptyAdnOptions);

    setup({ modelRelations: [{ subprincipioId: "", isFoco: true, habilidadesImprescindibles: [], items: [] }] });

    await waitFor(() => {
      expect(gameModelService.getAdnOptions).toHaveBeenCalled();
    });

    expect(screen.getByText(/Modelo ADN/i)).toBeInTheDocument();
    const combobox = screen.getByRole("combobox", { name: /subprincipio/i });
    expect(combobox).toBeDisabled();
  });

  it("añade una relación vacía (sin Subprincipio) al pulsar 'Añadir vínculo'", async () => {
    (gameModelService.getAdnOptions as ReturnType<typeof vi.fn>).mockResolvedValue(adnOptionsWithData);
    const onChange = vi.fn();

    setup({ modelRelations: [], onChange });

    await waitFor(() => {
      expect(gameModelService.getAdnOptions).toHaveBeenCalled();
    });

    await userEvent.click(screen.getByRole("button", { name: /añadir vínculo/i }));

    expect(onChange).toHaveBeenCalledWith([
      { subprincipioId: "", isFoco: true, habilidadesImprescindibles: [], items: [] },
    ]);
  });

  it("no permite añadir un item (X.Y.Z) hasta que la relación tenga un Subprincipio elegido", async () => {
    (gameModelService.getAdnOptions as ReturnType<typeof vi.fn>).mockResolvedValue(adnOptionsWithData);

    setup({ modelRelations: [{ subprincipioId: "", isFoco: true, habilidadesImprescindibles: [], items: [] }] });

    await waitFor(() => {
      expect(gameModelService.getAdnOptions).toHaveBeenCalled();
    });

    expect(screen.getByRole("button", { name: /acción/i })).toBeDisabled();
  });

  it("añade un item narrowed al SubSubPrincipio del Subprincipio elegido en la relación", async () => {
    (gameModelService.getAdnOptions as ReturnType<typeof vi.fn>).mockResolvedValue(adnOptionsWithData);
    const onChange = vi.fn();

    setup({
      modelRelations: [{ subprincipioId: "sub-1", isFoco: true, habilidadesImprescindibles: [], items: [] }],
      onChange,
    });

    await waitFor(() => {
      expect(gameModelService.getAdnOptions).toHaveBeenCalled();
    });

    await userEvent.click(screen.getByRole("button", { name: /acción/i }));

    expect(onChange).toHaveBeenCalledWith([
      {
        subprincipioId: "sub-1",
        isFoco: true,
        habilidadesImprescindibles: [],
        items: [{ subSubPrincipioId: "", isFoco: true }],
      },
    ]);
  });

  it("alterna FOCO/INTEGRADO a nivel de relación", async () => {
    (gameModelService.getAdnOptions as ReturnType<typeof vi.fn>).mockResolvedValue(adnOptionsWithData);
    const onChange = vi.fn();

    setup({
      modelRelations: [{ subprincipioId: "sub-1", isFoco: true, habilidadesImprescindibles: [], items: [] }],
      onChange,
    });

    await waitFor(() => {
      expect(gameModelService.getAdnOptions).toHaveBeenCalled();
    });

    await userEvent.click(screen.getByRole("button", { name: /integrado/i }));

    expect(onChange).toHaveBeenCalledWith([
      { subprincipioId: "sub-1", isFoco: false, habilidadesImprescindibles: [], items: [] },
    ]);
  });

  it("elimina una relación al pulsar su botón de eliminar", async () => {
    (gameModelService.getAdnOptions as ReturnType<typeof vi.fn>).mockResolvedValue(adnOptionsWithData);
    const onChange = vi.fn();

    setup({
      modelRelations: [
        { subprincipioId: "sub-1", isFoco: true, habilidadesImprescindibles: [], items: [] },
      ],
      onChange,
    });

    await waitFor(() => {
      expect(gameModelService.getAdnOptions).toHaveBeenCalled();
    });

    await userEvent.click(screen.getByRole("button", { name: /eliminar vínculo/i }));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("renderiza el Autocomplete de Habilidades por relación (no global) con el vocabulario cerrado", async () => {
    (gameModelService.getAdnOptions as ReturnType<typeof vi.fn>).mockResolvedValue(adnOptionsWithData);

    setup({
      modelRelations: [{ subprincipioId: "sub-1", isFoco: true, habilidadesImprescindibles: ["Pase"], items: [] }],
    });

    await waitFor(() => {
      expect(gameModelService.getAdnOptions).toHaveBeenCalled();
    });

    const habilidadesInput = screen.getByRole("combobox", { name: /habilidades/i });
    await userEvent.click(habilidadesInput);
    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getByText("Intercepción")).toBeInTheDocument();
  });
});
