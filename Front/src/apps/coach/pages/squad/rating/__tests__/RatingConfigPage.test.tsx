import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../../../../../shared/components/ui/ContentLayout/ContentLayout", () => ({
  default: ({ actionBar, children }: { actionBar?: React.ReactNode; children?: React.ReactNode }) => (
    <div>
      <div>{actionBar}</div>
      <div>{children}</div>
    </div>
  ),
}));

vi.mock("../../../../services/ratingConfigService", () => ({
  getRatingConfig: vi.fn(),
  createTrait: vi.fn(),
  updateTrait: vi.fn(),
  setTraitVisibility: vi.fn(),
  createCapacity: vi.fn(),
  updateCapacity: vi.fn(),
  setCapacityVisibility: vi.fn(),
}));

const mockUsePermissions = vi.fn();
vi.mock("../../../../../../shared/hooks/usePermissions", () => ({
  usePermissions: () => mockUsePermissions(),
}));

import RatingConfigPage from "../RatingConfigPage";
import {
  createCapacity,
  createTrait,
  getRatingConfig,
  setCapacityVisibility,
  setTraitVisibility,
  updateCapacity,
  updateTrait,
} from "../../../../services/ratingConfigService";
import type { RatingConfig } from "../../../../types/ratingConfig";

const texts = Array.from({ length: 10 }, (_, i) => `Texto propio ${i + 1}`);

/** Etiqueta de un campo obligatorio: MUI añade « *» al texto. */
const field = (text: string) => new RegExp(`^${text}( \\*)?$`);

const config: RatingConfig = {
  capacities: [
    { key: "custom-c", isCustom: true, isHidden: false, sheet: "field", categoryKey: "technical", label: "Juego aéreo ofensivo", levelTexts: texts },
    { key: "physicalSpeed", isCustom: false, isHidden: true, sheet: "field", categoryKey: "physical", label: null, levelTexts: null },
  ],
  traits: [
    { key: "custom-t", isCustom: true, isHidden: false, label: "Juego aéreo", phase: "withBall", anchor1: "Nunca", anchor3: "A veces", anchor5: "Siempre" },
    { key: "traitDuels", isCustom: false, isHidden: true, label: null, phase: null, anchor1: null, anchor3: null, anchor5: null },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/coach/squad/rating-sheet?teamId=team-1&seasonId=season-1&view=config"]}>
      <Routes>
        <Route path="/coach/squad/rating-sheet" element={<RatingConfigPage />} />
        <Route path="/coach/squad" element={<div>Plantilla</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function renderLoaded() {
  renderPage();
  await screen.findByRole("button", { name: "Añadir capacidad" });
}

async function openTraits(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Rasgos" }));
  await screen.findByRole("button", { name: "Añadir rasgo" });
}

describe("RatingConfigPage", () => {
  const dispatchSpy = vi.spyOn(window, "dispatchEvent");

  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePermissions.mockReturnValue({ roles: ["Coach"] });
    vi.mocked(getRatingConfig).mockResolvedValue(config);
    vi.mocked(createTrait).mockResolvedValue({ ...config.traits[0] });
    vi.mocked(updateTrait).mockResolvedValue({ ...config.traits[0] });
    vi.mocked(setTraitVisibility).mockResolvedValue({ ...config.traits[0] });
    vi.mocked(createCapacity).mockResolvedValue({ ...config.capacities[0] });
    vi.mocked(updateCapacity).mockResolvedValue({ ...config.capacities[0] });
    vi.mocked(setCapacityVisibility).mockResolvedValue({ ...config.capacities[0] });
  });

  afterEach(() => {
    dispatchSpy.mockClear();
  });

  // ── Estructura ──────────────────────────────────────────────────────────

  it("muestra las pestañas Capacidades y Rasgos y empieza por Capacidades", async () => {
    await renderLoaded();

    expect(screen.getByRole("button", { name: "Capacidades" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Rasgos" })).toHaveAttribute("aria-pressed", "false");
  });

  it("lista las capacidades por defecto, la propia y la oculta, con sus marcas", async () => {
    await renderLoaded();

    const velocidad = screen.getByRole("listitem", { name: "Velocidad" });
    expect(within(velocidad).getByText("Oculta")).toBeInTheDocument();
    expect(within(velocidad).getByRole("button", { name: "Restaurar Velocidad" })).toBeInTheDocument();
    const propia = screen.getByRole("listitem", { name: "Juego aéreo ofensivo" });
    expect(within(propia).getByText("Propia")).toBeInTheDocument();
    expect(within(propia).getByRole("button", { name: "Ocultar Juego aéreo ofensivo" })).toBeInTheDocument();
    const regate = screen.getByRole("listitem", { name: "Regate" });
    expect(within(regate).queryByText("Propia")).not.toBeInTheDocument();
    expect(within(regate).queryByText("Oculta")).not.toBeInTheDocument();
  });

  it("separa las capacidades de campo y de porteros", async () => {
    await renderLoaded();

    expect(screen.getByRole("heading", { name: "Jugadores" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Porteros" })).toBeInTheDocument();
  });

  it("en Rasgos lista los 12 por defecto y el propio agrupados por fase", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await openTraits(user);

    for (const phase of ["Con balón", "Sin balón", "Transiciones", "Transversales"]) {
      expect(screen.getByRole("heading", { name: phase })).toBeInTheDocument();
    }
    expect(screen.getAllByRole("listitem")).toHaveLength(13);
    expect(within(screen.getByRole("listitem", { name: "Juego aéreo" })).getByText("Propia")).toBeInTheDocument();
    expect(within(screen.getByRole("listitem", { name: "Gana duelos" })).getByText("Oculta")).toBeInTheDocument();
  });

  it("muestra un error si no se puede cargar la configuración", async () => {
    vi.mocked(getRatingConfig).mockRejectedValue(new Error("403"));
    renderPage();

    expect(await screen.findByText(/No se pudo cargar la configuración/)).toBeInTheDocument();
  });

  // ── Rasgos ──────────────────────────────────────────────────────────────

  it("añade un rasgo y lo avisa", async () => {
    const user = userEvent.setup();
    await renderLoaded();
    await openTraits(user);

    await user.click(screen.getByRole("button", { name: "Añadir rasgo" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Nuevo rasgo" }));
    await user.type(dialog.getByLabelText(field("Etiqueta")), "Juego con la zurda");
    await user.type(dialog.getByLabelText(field("Descriptor del nivel 1")), "Nunca");
    await user.type(dialog.getByLabelText(field("Descriptor del nivel 3")), "A veces");
    await user.type(dialog.getByLabelText(field("Descriptor del nivel 5")), "Siempre");
    await user.click(dialog.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(createTrait).toHaveBeenCalledWith("team-1", {
        label: "Juego con la zurda",
        phase: "withBall",
        anchor1: "Nunca",
        anchor3: "A veces",
        anchor5: "Siempre",
      }),
    );
    await waitFor(() => expect(getRatingConfig).toHaveBeenCalledTimes(2));
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "rffm.show_snackbar", detail: { message: "Rasgo creado", severity: "success" } }),
    );
  });

  it("no deja guardar un rasgo sin etiqueta o sin descriptores", async () => {
    const user = userEvent.setup();
    await renderLoaded();
    await openTraits(user);

    await user.click(screen.getByRole("button", { name: "Añadir rasgo" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Nuevo rasgo" }));

    expect(dialog.getByRole("button", { name: "Guardar" })).toBeDisabled();
    await user.type(dialog.getByLabelText(field("Etiqueta")), "Algo");
    expect(dialog.getByRole("button", { name: "Guardar" })).toBeDisabled();
    expect(createTrait).not.toHaveBeenCalled();
  });

  it("edita un rasgo por defecto y solo envía lo que cambia", async () => {
    const user = userEvent.setup();
    await renderLoaded();
    await openTraits(user);

    await user.click(screen.getByRole("button", { name: "Editar Presiona y orienta" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Editar rasgo" }));
    const label = dialog.getByLabelText(field("Etiqueta"));
    expect(label).toHaveValue("Presiona y orienta");
    await user.clear(label);
    await user.type(label, "Presiona alto");
    await user.click(dialog.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(updateTrait).toHaveBeenCalledWith("team-1", "traitPressing", { label: "Presiona alto" }));
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { message: "Rasgo actualizado", severity: "success" } }),
    );
  });

  it("pide confirmación antes de ocultar un rasgo", async () => {
    const user = userEvent.setup();
    await renderLoaded();
    await openTraits(user);

    await user.click(screen.getByRole("button", { name: "Ocultar Presiona y orienta" }));

    expect(await screen.findByText("Ocultar rasgo")).toBeInTheDocument();
    expect(setTraitVisibility).not.toHaveBeenCalled();
  });

  it("oculta el rasgo al confirmar", async () => {
    const user = userEvent.setup();
    await renderLoaded();
    await openTraits(user);

    await user.click(screen.getByRole("button", { name: "Ocultar Presiona y orienta" }));
    await user.click(await screen.findByRole("button", { name: "Ocultar" }));

    await waitFor(() => expect(setTraitVisibility).toHaveBeenCalledWith("team-1", "traitPressing", true));
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { message: "Rasgo ocultado", severity: "success" } }),
    );
  });

  it("no oculta el rasgo si se cancela", async () => {
    const user = userEvent.setup();
    await renderLoaded();
    await openTraits(user);

    await user.click(screen.getByRole("button", { name: "Ocultar Presiona y orienta" }));
    await user.click(await screen.findByRole("button", { name: "Cancelar" }));

    expect(setTraitVisibility).not.toHaveBeenCalled();
  });

  it("restaura un rasgo oculto sin pedir confirmación", async () => {
    const user = userEvent.setup();
    await renderLoaded();
    await openTraits(user);

    await user.click(screen.getByRole("button", { name: "Restaurar Gana duelos" }));

    await waitFor(() => expect(setTraitVisibility).toHaveBeenCalledWith("team-1", "traitDuels", false));
  });

  it("avisa con un error si falla el guardado", async () => {
    vi.mocked(createTrait).mockRejectedValue(new Error("boom"));
    const user = userEvent.setup();
    await renderLoaded();
    await openTraits(user);
    await user.click(screen.getByRole("button", { name: "Añadir rasgo" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Nuevo rasgo" }));
    await user.type(dialog.getByLabelText(field("Etiqueta")), "Algo");
    await user.type(dialog.getByLabelText(field("Descriptor del nivel 1")), "a");
    await user.type(dialog.getByLabelText(field("Descriptor del nivel 3")), "b");
    await user.type(dialog.getByLabelText(field("Descriptor del nivel 5")), "c");

    await user.click(dialog.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ detail: { message: "Error al guardar la configuración", severity: "error" } }),
      ),
    );
  });

  // ── Capacidades ─────────────────────────────────────────────────────────

  it("añade una capacidad de porteros con sus 10 textos", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(screen.getByRole("button", { name: "Añadir capacidad" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Nueva capacidad" }));
    await user.click(dialog.getByRole("combobox", { name: "Hoja" }));
    await user.click(await screen.findByRole("option", { name: "Porteros" }));
    await user.type(dialog.getByLabelText(field("Etiqueta")), "Juego con los pies");
    for (let level = 1; level <= 10; level += 1) {
      fireEvent.change(dialog.getByLabelText(field(`Texto del nivel ${level}`)), { target: { value: `Nivel ${level}` } });
    }
    await user.click(dialog.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(createCapacity).toHaveBeenCalledWith("team-1", {
        sheet: "goalkeeper",
        categoryKey: "physical",
        label: "Juego con los pies",
        levelTexts: Array.from({ length: 10 }, (_, i) => `Nivel ${i + 1}`),
      }),
    );
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { message: "Capacidad creada", severity: "success" } }),
    );
  });

  it("no deja guardar una capacidad con algún texto de nivel vacío", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(screen.getByRole("button", { name: "Añadir capacidad" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Nueva capacidad" }));
    await user.type(dialog.getByLabelText(field("Etiqueta")), "Algo");
    for (let level = 1; level <= 9; level += 1) {
      fireEvent.change(dialog.getByLabelText(field(`Texto del nivel ${level}`)), { target: { value: "x" } });
    }

    expect(dialog.getByRole("button", { name: "Guardar" })).toBeDisabled();
  });

  it("al editar una capacidad por defecto envía su hoja y su categoría y solo la etiqueta cambiada", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(screen.getByRole("button", { name: "Editar Regate" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Editar capacidad" }));
    const label = dialog.getByLabelText(field("Etiqueta"));
    await user.clear(label);
    await user.type(label, "Regate en corto");
    await user.click(dialog.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(updateCapacity).toHaveBeenCalledWith("team-1", "technicalDribbling", {
        label: "Regate en corto",
        sheet: "field",
        categoryKey: "technical",
      }),
    );
  });

  it("al editar una capacidad propia no se puede cambiar su hoja ni su categoría", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(screen.getByRole("button", { name: "Editar Juego aéreo ofensivo" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Editar capacidad" }));

    expect(dialog.queryByRole("combobox", { name: "Hoja" })).not.toBeInTheDocument();
    expect(dialog.queryByRole("combobox", { name: "Categoría" })).not.toBeInTheDocument();
    expect(dialog.getByLabelText(field("Texto del nivel 10"))).toHaveValue("Texto propio 10");
  });

  it("oculta una capacidad por defecto enviando su hoja y su categoría", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(screen.getByRole("button", { name: "Ocultar Regate" }));
    await user.click(await screen.findByRole("button", { name: "Ocultar" }));

    await waitFor(() =>
      expect(setCapacityVisibility).toHaveBeenCalledWith("team-1", "technicalDribbling", true, { sheet: "field", categoryKey: "technical" }),
    );
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { message: "Capacidad ocultada", severity: "success" } }),
    );
  });

  it("restaura una capacidad oculta", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(screen.getByRole("button", { name: "Restaurar Velocidad" }));

    await waitFor(() =>
      expect(setCapacityVisibility).toHaveBeenCalledWith("team-1", "physicalSpeed", false, { sheet: "field", categoryKey: "physical" }),
    );
  });

  // ── Permisos y navegación ───────────────────────────────────────────────

  it("es de solo lectura para quien no es entrenador ni administrador", async () => {
    mockUsePermissions.mockReturnValue({ roles: ["Player"] });
    renderPage();
    await screen.findByRole("listitem", { name: "Regate" });

    expect(screen.queryByRole("button", { name: "Añadir capacidad" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar Regate" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ocultar Regate" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Restaurar Velocidad" })).not.toBeInTheDocument();
  });

  it("vuelve a la plantilla", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(screen.getByRole("button", { name: "Volver" }));

    expect(await screen.findByText("Plantilla")).toBeInTheDocument();
  });
});
