import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
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

vi.mock("../../../../services/positionFitService", () => ({
  getTeamPositionFit: vi.fn(),
  savePositionFitOrder: vi.fn(),
  savePositionTraitWeights: vi.fn(),
}));

const mockUsePermissions = vi.fn();
vi.mock("../../../../../../shared/hooks/usePermissions", () => ({
  usePermissions: () => mockUsePermissions(),
}));

import PositionFitPage from "../PositionFitPage";
import {
  getTeamPositionFit,
  savePositionFitOrder,
  savePositionTraitWeights,
} from "../../../../services/positionFitService";
import { DEFAULT_TRAIT_WEIGHTS } from "../ratingTraits";
import type { PositionFit } from "../../../../types/positionFit";

function position(key: PositionFit["position"], candidates: PositionFit["candidates"], extra: Partial<PositionFit> = {}): PositionFit {
  return {
    position: key,
    confirmedWeekStart: null,
    isManual: false,
    candidates,
    weights: DEFAULT_TRAIT_WEIGHTS[key],
    ...extra,
  };
}

const mcdCandidates: PositionFit["candidates"] = [
  { teamPlayerId: "a", name: "Álvaro", place: 1, fit: 4.2, trend: "up" },
  { teamPlayerId: "b", name: "Bruno", place: 2, fit: 3.8, trend: "same" },
  { teamPlayerId: "c", name: "Araque", place: 3, fit: null, trend: "down" },
];

const data: PositionFit[] = [
  position("centerBack", []),
  position("fullBack", []),
  position("defensiveMidfielder", mcdCandidates),
  position("midfielder", [{ teamPlayerId: "m", name: "Marcos", place: 1, fit: 3.0, trend: "same" }]),
  position("attackingMidfielder", []),
  position("winger", []),
  position("forward", []),
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/coach/squad/rating-sheet?teamId=team-1&seasonId=season-1&view=order"]}>
      <Routes>
        <Route path="/coach/squad/rating-sheet" element={<PositionFitPage />} />
        <Route path="/coach/squad" element={<div>Plantilla</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function renderLoadedPage() {
  renderPage();
  await screen.findByRole("list", { name: /Candidatos de Mediocentro defensivo/ });
}

function names() {
  return within(screen.getByRole("list", { name: /Candidatos de/ }))
    .getAllByRole("listitem")
    .map((item) => within(item).getByTestId("candidate-name").textContent);
}

describe("PositionFitPage", () => {
  const dispatchSpy = vi.spyOn(window, "dispatchEvent");

  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePermissions.mockReturnValue({ roles: ["Coach"] });
    vi.mocked(getTeamPositionFit).mockResolvedValue(data);
    vi.mocked(savePositionFitOrder).mockResolvedValue(position("defensiveMidfielder", mcdCandidates));
    vi.mocked(savePositionTraitWeights).mockResolvedValue(position("defensiveMidfielder", mcdCandidates));
  });

  afterEach(() => {
    dispatchSpy.mockClear();
  });

  it("selecciona por defecto el primer puesto con candidatos", async () => {
    await renderLoadedPage();

    expect(screen.getByRole("button", { name: /Mediocentro defensivo/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("muestra los siete puestos con su número de candidatos", async () => {
    await renderLoadedPage();

    for (const label of ["Central", "Lateral/Carrilero", "Mediocentro defensivo", "Mediocentro", "Mediapunta", "Extremo", "Delantero"]) {
      expect(screen.getByRole("button", { name: new RegExp(`^${label.replace("/", "\\/")}\\d+$`) })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: /Mediocentro defensivo.*3/ })).toBeInTheDocument();
  });

  it("lista los candidatos con su lugar, encaje y «Sin datos» cuando no hay encaje", async () => {
    await renderLoadedPage();

    expect(names()).toEqual(["Álvaro", "Bruno", "Araque"]);
    expect(screen.getByText("Encaje 4,2")).toBeInTheDocument();
    expect(screen.getByText("Sin datos")).toBeInTheDocument();
  });

  it("indica la tendencia de cada candidato", async () => {
    await renderLoadedPage();

    expect(screen.getByLabelText("Tendencia: sube")).toBeInTheDocument();
    expect(screen.getByLabelText("Tendencia: baja")).toBeInTheDocument();
  });

  it("indica que el orden es el propuesto por encaje cuando no hay ninguno confirmado", async () => {
    await renderLoadedPage();

    expect(screen.getByText("Orden propuesto por encaje")).toBeInTheDocument();
  });

  it("indica la semana del orden confirmado y si se corrigió a mano", async () => {
    vi.mocked(getTeamPositionFit).mockResolvedValue([
      ...data.slice(0, 2),
      position("defensiveMidfielder", mcdCandidates, { confirmedWeekStart: "2026-11-09T00:00:00", isManual: true }),
      ...data.slice(3),
    ]);
    renderPage();

    expect(await screen.findByText(/Orden confirmado de la semana del 9\/11\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/corregido a mano/)).toBeInTheDocument();
  });

  it("cambia de puesto", async () => {
    const user = userEvent.setup();
    await renderLoadedPage();

    await user.click(screen.getByRole("button", { name: /^Mediocentro\d+$/ }));

    expect(await screen.findByRole("list", { name: /Candidatos de Mediocentro$/ })).toBeInTheDocument();
    expect(names()).toEqual(["Marcos"]);
  });

  it("sube y baja candidatos con los botones", async () => {
    const user = userEvent.setup();
    await renderLoadedPage();

    await user.click(screen.getByRole("button", { name: "Subir a Bruno" }));
    expect(names()).toEqual(["Bruno", "Álvaro", "Araque"]);

    await user.click(screen.getByRole("button", { name: "Bajar a Bruno" }));
    expect(names()).toEqual(["Álvaro", "Bruno", "Araque"]);
  });

  it("deshabilita subir al primero y bajar al último", async () => {
    await renderLoadedPage();

    expect(screen.getByRole("button", { name: "Subir a Álvaro" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Bajar a Araque" })).toBeDisabled();
  });

  it("guarda el orden del puesto y avisa", async () => {
    const user = userEvent.setup();
    await renderLoadedPage();
    expect(screen.getByRole("button", { name: "Guardar orden" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Subir a Bruno" }));
    await user.click(screen.getByRole("button", { name: "Guardar orden" }));

    await waitFor(() =>
      expect(savePositionFitOrder).toHaveBeenCalledWith("team-1", "defensiveMidfielder", ["b", "a", "c"]),
    );
    await waitFor(() =>
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: "rffm.show_snackbar", detail: { message: "Orden guardado", severity: "success" } }),
      ),
    );
  });

  it("avisa con un error si falla el guardado del orden", async () => {
    vi.mocked(savePositionFitOrder).mockRejectedValue(new Error("boom"));
    const user = userEvent.setup();
    await renderLoadedPage();

    await user.click(screen.getByRole("button", { name: "Subir a Bruno" }));
    await user.click(screen.getByRole("button", { name: "Guardar orden" }));

    await waitFor(() =>
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ detail: { message: "Error al guardar el orden", severity: "error" } }),
      ),
    );
  });

  it("restablece el orden propuesto", async () => {
    const user = userEvent.setup();
    await renderLoadedPage();
    await user.click(screen.getByRole("button", { name: "Subir a Bruno" }));

    await user.click(screen.getByRole("button", { name: "Restablecer" }));

    expect(names()).toEqual(["Álvaro", "Bruno", "Araque"]);
  });

  it("es de solo lectura para quien no es entrenador ni administrador", async () => {
    mockUsePermissions.mockReturnValue({ roles: ["Player"] });
    await renderLoadedPage();

    expect(screen.queryByRole("button", { name: "Guardar orden" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Subir a Bruno" })).toBeDisabled();
  });

  it("pide confirmación al volver con cambios sin guardar", async () => {
    const user = userEvent.setup();
    await renderLoadedPage();
    await user.click(screen.getByRole("button", { name: "Subir a Bruno" }));

    await user.click(screen.getByRole("button", { name: "Volver" }));

    expect(await screen.findByText("Salir sin guardar")).toBeInTheDocument();
  });

  it("pide confirmación al cambiar de vista con cambios sin guardar", async () => {
    const user = userEvent.setup();
    await renderLoadedPage();
    await user.click(screen.getByRole("button", { name: "Subir a Bruno" }));

    await user.click(screen.getByRole("button", { name: "Capacidad" }));

    expect(await screen.findByText("Cambiar de vista")).toBeInTheDocument();
  });

  it("muestra un mensaje cuando el puesto no tiene candidatos", async () => {
    const user = userEvent.setup();
    await renderLoadedPage();

    await user.click(screen.getByRole("button", { name: /^Delantero/ }));

    expect(await screen.findByText("No hay candidatos para este puesto.")).toBeInTheDocument();
  });

  describe("pesos del puesto", () => {
    async function openWeights(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByRole("button", { name: /Pesos del puesto/ }));
    }

    it("muestra el peso de cada rasgo para el puesto", async () => {
      const user = userEvent.setup();
      await renderLoadedPage();

      await openWeights(user);

      const coverage = within(screen.getByRole("group", { name: "Peso de Posición y cobertura" }));
      expect(coverage.getByRole("button", { name: "Clave" })).toHaveAttribute("aria-pressed", "true");
    });

    it("guarda los pesos del puesto con el cambio", async () => {
      const user = userEvent.setup();
      await renderLoadedPage();
      await openWeights(user);
      expect(screen.getByRole("button", { name: "Guardar pesos" })).toBeDisabled();

      await user.click(within(screen.getByRole("group", { name: "Peso de Presiona y orienta" })).getByRole("button", { name: "Indiferente" }));
      await user.click(screen.getByRole("button", { name: "Guardar pesos" }));

      await waitFor(() =>
        expect(savePositionTraitWeights).toHaveBeenCalledWith(
          "team-1",
          "defensiveMidfielder",
          expect.objectContaining({ traitPressing: "indifferent", traitCoverage: "key" }),
        ),
      );
      await waitFor(() =>
        expect(dispatchSpy).toHaveBeenCalledWith(
          expect.objectContaining({ detail: { message: "Pesos guardados", severity: "success" } }),
        ),
      );
    });

    it("no permite cambiar pesos a quien no es entrenador ni administrador", async () => {
      mockUsePermissions.mockReturnValue({ roles: ["Player"] });
      const user = userEvent.setup();
      await renderLoadedPage();

      await openWeights(user);

      expect(within(screen.getByRole("group", { name: "Peso de Presiona y orienta" })).getByRole("button", { name: "Suma" })).toBeDisabled();
      expect(screen.queryByRole("button", { name: "Guardar pesos" })).not.toBeInTheDocument();
    });
  });

  it("muestra un error si no se puede cargar el encaje", async () => {
    vi.mocked(getTeamPositionFit).mockRejectedValue(new Error("boom"));
    renderPage();

    expect(await screen.findByText(/No se pudo cargar el encaje/)).toBeInTheDocument();
  });
});
