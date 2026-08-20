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
import type { ExerciseModelLinkRequest } from "../../../../../types/training";

const adnOptionsWithData = {
  subprincipios: [
    { id: "sub-1", numero: "1.1", titulo: "Presión alta", gameMomentName: "Fase defensiva" },
  ],
  subSubPrincipios: [{ id: "ssp-1", numero: "1.1.1", rol: "Central", subprincipioId: "sub-1" }],
};

const emptyAdnOptions = { subprincipios: [], subSubPrincipios: [] };

function setup(
  overrides: Partial<{
    modelLinks: ExerciseModelLinkRequest[];
    habilidades: string[];
    onChangeModelLinks: (links: ExerciseModelLinkRequest[]) => void;
    onChangeHabilidades: (habilidades: string[]) => void;
    teamId?: string;
  }> = {}
) {
  const onChangeModelLinks = overrides.onChangeModelLinks ?? vi.fn();
  const onChangeHabilidades = overrides.onChangeHabilidades ?? vi.fn();
  render(
    <MemoryRouter>
      <ModelRelationSection
        modelLinks={overrides.modelLinks ?? []}
        habilidades={overrides.habilidades ?? []}
        onChangeModelLinks={onChangeModelLinks}
        onChangeHabilidades={onChangeHabilidades}
        teamId={overrides.teamId ?? "team-1"}
      />
    </MemoryRouter>
  );
  return { onChangeModelLinks, onChangeHabilidades };
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

    setup({ modelLinks: [{ subprincipioId: null, subSubPrincipioId: null, isFoco: true }] });

    await waitFor(() => {
      expect(gameModelService.getAdnOptions).toHaveBeenCalledWith("team-1", "2026-2027");
    });

    const combobox = await screen.findByRole("combobox", { name: /subprincipio.*subsubprincipio/i });
    await userEvent.click(combobox);
    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getByText(/1.1.*Presión alta/)).toBeInTheDocument();
    expect(within(listbox).getByText(/1.1.1.*Central/)).toBeInTheDocument();
  });

  it("muestra el estado vacío (mensaje + campos deshabilitados) cuando el equipo no tiene GameModel", async () => {
    (gameModelService.getAdnOptions as ReturnType<typeof vi.fn>).mockResolvedValue(emptyAdnOptions);

    setup({ modelLinks: [{ subprincipioId: null, subSubPrincipioId: null, isFoco: true }] });

    await waitFor(() => {
      expect(gameModelService.getAdnOptions).toHaveBeenCalled();
    });

    expect(screen.getByText(/Modelo ADN/i)).toBeInTheDocument();
    const combobox = screen.getByRole("combobox", { name: /subprincipio.*subsubprincipio/i });
    expect(combobox).toBeDisabled();
  });

  it("alterna FOCO/INTEGRADO en una fila y notifica el cambio", async () => {
    (gameModelService.getAdnOptions as ReturnType<typeof vi.fn>).mockResolvedValue(adnOptionsWithData);
    const onChangeModelLinks = vi.fn();

    setup({
      modelLinks: [{ subprincipioId: "sub-1", subSubPrincipioId: null, isFoco: true }],
      onChangeModelLinks,
    });

    await waitFor(() => {
      expect(gameModelService.getAdnOptions).toHaveBeenCalled();
    });

    const integradoBtn = screen.getByRole("button", { name: /integrado/i });
    await userEvent.click(integradoBtn);

    expect(onChangeModelLinks).toHaveBeenCalledWith([
      { subprincipioId: "sub-1", subSubPrincipioId: null, isFoco: false },
    ]);
  });

  it("añade una fila nueva vacía al pulsar 'Añadir vínculo'", async () => {
    (gameModelService.getAdnOptions as ReturnType<typeof vi.fn>).mockResolvedValue(adnOptionsWithData);
    const onChangeModelLinks = vi.fn();

    setup({ modelLinks: [], onChangeModelLinks });

    await waitFor(() => {
      expect(gameModelService.getAdnOptions).toHaveBeenCalled();
    });

    await userEvent.click(screen.getByRole("button", { name: /añadir vínculo/i }));

    expect(onChangeModelLinks).toHaveBeenCalledWith([
      { subprincipioId: null, subSubPrincipioId: null, isFoco: true },
    ]);
  });

  it("elimina una fila al pulsar su botón de eliminar", async () => {
    (gameModelService.getAdnOptions as ReturnType<typeof vi.fn>).mockResolvedValue(adnOptionsWithData);
    const onChangeModelLinks = vi.fn();

    setup({
      modelLinks: [
        { subprincipioId: "sub-1", subSubPrincipioId: null, isFoco: true },
        { subprincipioId: null, subSubPrincipioId: "ssp-1", isFoco: false },
      ],
      onChangeModelLinks,
    });

    await waitFor(() => {
      expect(gameModelService.getAdnOptions).toHaveBeenCalled();
    });

    const deleteButtons = screen.getAllByRole("button", { name: /eliminar vínculo/i });
    await userEvent.click(deleteButtons[0]);

    expect(onChangeModelLinks).toHaveBeenCalledWith([
      { subprincipioId: null, subSubPrincipioId: "ssp-1", isFoco: false },
    ]);
  });

  it("renderiza el Autocomplete de habilidades con las opciones del vocabulario cerrado", async () => {
    (gameModelService.getAdnOptions as ReturnType<typeof vi.fn>).mockResolvedValue(emptyAdnOptions);

    setup({ habilidades: ["Pase"] });

    await waitFor(() => {
      expect(gameModelService.getAdnOptions).toHaveBeenCalled();
    });

    const habilidadesInput = screen.getByRole("combobox", { name: /habilidades/i });
    expect(habilidadesInput).not.toBeDisabled();
    await userEvent.click(habilidadesInput);
    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getByText("Intercepción")).toBeInTheDocument();
  });

  it("notifica el cambio de habilidades seleccionadas", async () => {
    (gameModelService.getAdnOptions as ReturnType<typeof vi.fn>).mockResolvedValue(emptyAdnOptions);
    const onChangeHabilidades = vi.fn();

    setup({ habilidades: [], onChangeHabilidades });

    await waitFor(() => {
      expect(gameModelService.getAdnOptions).toHaveBeenCalled();
    });

    const habilidadesInput = screen.getByRole("combobox", { name: /habilidades/i });
    await userEvent.click(habilidadesInput);
    const listbox = screen.getByRole("listbox");
    await userEvent.click(within(listbox).getByText("Pase"));

    expect(onChangeHabilidades).toHaveBeenCalledWith(["Pase"]);
  });
});
