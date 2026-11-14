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

vi.mock("../../../../services/teamplayerService", () => ({ getPlayersByTeam: vi.fn() }));
vi.mock("../../../../services/traitRatingService", () => ({
  getTeamLatestTraitRatings: vi.fn(),
  createTeamTraitRatings: vi.fn(),
}));

const mockUsePermissions = vi.fn();
vi.mock("../../../../../../shared/hooks/usePermissions", () => ({
  usePermissions: () => mockUsePermissions(),
}));

import TraitRatingPage from "../TraitRatingPage";
import { getPlayersByTeam } from "../../../../services/teamplayerService";
import { createTeamTraitRatings, getTeamLatestTraitRatings } from "../../../../services/traitRatingService";

const players = [
  { id: "juan", name: "Juan", lastName: "Pérez", alias: "", position: "Medio Centro", dorsal: 8, activePositionId: 6 },
  { id: "pedro", name: "Pedro", lastName: "Ruiz", alias: "", position: "Defensa Central", dorsal: 4, activePositionId: 4 },
  { id: "iker", name: "Iker", lastName: "Sanz", alias: "", position: "Portero", dorsal: 1, activePositionId: 1 },
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/coach/squad/rating-sheet?teamId=team-1&seasonId=season-1&view=traits"]}>
      <Routes>
        <Route path="/coach/squad/rating-sheet" element={<TraitRatingPage />} />
        <Route path="/coach/squad" element={<div>Plantilla</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Abre la página y cambia a la vista «Por jugador» (por defecto se muestra el tablero por rasgo). */
async function renderLoadedPage() {
  renderPage();
  await userEvent.click(await screen.findByRole("button", { name: "Por jugador" }));
  await screen.findByRole("button", { name: /Juan Pérez.*\d\/12/ });
}

async function renderLoadedBoard() {
  renderPage();
  await screen.findByRole("group", { name: "Sin colocar" });
}

async function expandPlayer(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
  await user.click(screen.getByRole("button", { name }));
}

describe("TraitRatingPage", () => {
  const dispatchSpy = vi.spyOn(window, "dispatchEvent");

  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePermissions.mockReturnValue({ roles: ["Coach"] });
    vi.mocked(getPlayersByTeam).mockResolvedValue(players);
    vi.mocked(getTeamLatestTraitRatings).mockResolvedValue([
      {
        id: "r1",
        teamPlayerId: "juan",
        ratedAt: "2026-11-02T00:00:00Z",
        trend: "same",
        levels: [{ traitKey: "traitCoverage", level: 4 }],
      },
    ]);
    vi.mocked(createTeamTraitRatings).mockResolvedValue([]);
  });

  afterEach(() => {
    dispatchSpy.mockClear();
  });

  it("muestra una tarjeta por jugador de campo y no muestra porteros", async () => {
    await renderLoadedPage();

    expect(screen.getByRole("button", { name: /Pedro Ruiz/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Iker Sanz/ })).not.toBeInTheDocument();
  });

  it("muestra el progreso de rasgos valorados de cada jugador", async () => {
    await renderLoadedPage();

    expect(screen.getByRole("button", { name: /Juan Pérez.*1\/12/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pedro Ruiz.*0\/12/ })).toBeInTheDocument();
  });

  it("al abrir un jugador muestra los 12 rasgos agrupados por fase", async () => {
    const user = userEvent.setup();
    await renderLoadedPage();

    await expandPlayer(user, /Juan Pérez/);

    for (const phase of ["Con balón", "Sin balón", "Transiciones", "Transversales"]) {
      expect(screen.getByText(phase)).toBeInTheDocument();
    }
    expect(screen.getByRole("group", { name: "Cumple su rol" })).toBeInTheDocument();
    expect(screen.getAllByRole("group", { name: /^(?!Tendencia)/ }).length).toBeGreaterThanOrEqual(12);
  });

  it("marca el nivel de la última valoración como anterior y como seleccionado", async () => {
    const user = userEvent.setup();
    await renderLoadedPage();

    await expandPlayer(user, /Juan Pérez/);

    const coverage = within(screen.getByRole("group", { name: "Posición y cobertura" }));
    expect(coverage.getByRole("button", { name: /nivel 4 \(anterior\)/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("seleccionar un nivel lo marca y habilita guardar con el número de jugadores", async () => {
    const user = userEvent.setup();
    await renderLoadedPage();
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();

    await expandPlayer(user, /Juan Pérez/);
    await user.click(within(screen.getByRole("group", { name: "Posición y cobertura" })).getByRole("button", { name: /nivel 5/ }));

    expect(within(screen.getByRole("group", { name: "Posición y cobertura" })).getByRole("button", { name: /nivel 5/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Guardar (1)" })).toBeEnabled();
  });

  it("permite marcar la tendencia del jugador", async () => {
    const user = userEvent.setup();
    await renderLoadedPage();
    await expandPlayer(user, /Juan Pérez/);

    await user.click(screen.getByRole("button", { name: "Baja" }));

    expect(screen.getByRole("button", { name: "Baja" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Guardar (1)" })).toBeEnabled();
  });

  it("guarda con la fecha elegida y avisa del resultado", async () => {
    const user = userEvent.setup();
    await renderLoadedPage();
    await expandPlayer(user, /Juan Pérez/);
    await user.click(within(screen.getByRole("group", { name: "Posición y cobertura" })).getByRole("button", { name: /nivel 5/ }));

    await user.click(screen.getByRole("button", { name: "Guardar (1)" }));

    await waitFor(() =>
      expect(createTeamTraitRatings).toHaveBeenCalledWith(
        "team-1",
        expect.objectContaining({ ratings: [expect.objectContaining({ teamPlayerId: "juan", trend: "same" })] }),
      ),
    );
    await waitFor(() =>
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: "rffm.show_snackbar", detail: { message: "Valoración guardada", severity: "success" } }),
      ),
    );
  });

  it("avisa con un error si falla el guardado", async () => {
    vi.mocked(createTeamTraitRatings).mockRejectedValue(new Error("boom"));
    const user = userEvent.setup();
    await renderLoadedPage();
    await expandPlayer(user, /Juan Pérez/);
    await user.click(within(screen.getByRole("group", { name: "Posición y cobertura" })).getByRole("button", { name: /nivel 5/ }));

    await user.click(screen.getByRole("button", { name: "Guardar (1)" }));

    await waitFor(() =>
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ detail: { message: "Error al guardar las valoraciones", severity: "error" } }),
      ),
    );
  });

  it("es de solo lectura para quien no es entrenador ni administrador", async () => {
    mockUsePermissions.mockReturnValue({ roles: ["Player"] });
    const user = userEvent.setup();
    await renderLoadedPage();

    expect(screen.queryByRole("button", { name: /Guardar/ })).not.toBeInTheDocument();
    await expandPlayer(user, /Juan Pérez/);
    expect(within(screen.getByRole("group", { name: "Posición y cobertura" })).getByRole("button", { name: /nivel 5/ })).toBeDisabled();
  });

  it("pide confirmación al volver con cambios sin guardar", async () => {
    const user = userEvent.setup();
    await renderLoadedPage();
    await expandPlayer(user, /Juan Pérez/);
    await user.click(within(screen.getByRole("group", { name: "Posición y cobertura" })).getByRole("button", { name: /nivel 5/ }));

    await user.click(screen.getByRole("button", { name: "Volver" }));

    expect(await screen.findByText("Salir sin guardar")).toBeInTheDocument();
    expect(screen.queryByText("Plantilla")).not.toBeInTheDocument();
  });

  it("vuelve directamente a la plantilla cuando no hay cambios", async () => {
    const user = userEvent.setup();
    await renderLoadedPage();

    await user.click(screen.getByRole("button", { name: "Volver" }));

    expect(await screen.findByText("Plantilla")).toBeInTheDocument();
  });

  it("pide confirmación al cambiar de vista con cambios sin guardar", async () => {
    const user = userEvent.setup();
    await renderLoadedPage();
    await expandPlayer(user, /Juan Pérez/);
    await user.click(within(screen.getByRole("group", { name: "Posición y cobertura" })).getByRole("button", { name: /nivel 5/ }));

    await user.click(screen.getByRole("button", { name: "Capacidad" }));

    expect(await screen.findByText("Cambiar de vista")).toBeInTheDocument();
  });

  it("muestra un error si no se pueden cargar los jugadores", async () => {
    vi.mocked(getPlayersByTeam).mockRejectedValue(new Error("boom"));
    renderPage();

    expect(await screen.findByText(/No se pudieron cargar/)).toBeInTheDocument();
  });

  describe("tablero por rasgo", () => {
    it("muestra por defecto el tablero por rasgo con los jugadores en su nivel", async () => {
      await renderLoadedBoard();

      expect(screen.getByRole("button", { name: "Por rasgo" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.queryByRole("button", { name: /Iker Sanz/ })).not.toBeInTheDocument();
      expect(within(screen.getByRole("group", { name: "Sin colocar" })).getByRole("button", { name: /Pedro Ruiz/ })).toBeInTheDocument();
    });

    it("coloca a un jugador en un nivel y habilita guardar", async () => {
      const user = userEvent.setup();
      await renderLoadedBoard();
      expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();

      await user.click(screen.getByRole("button", { name: /Pedro Ruiz/ }));
      await user.click(within(screen.getByRole("group", { name: "Nivel 3" })).getAllByRole("button")[0]);

      expect(within(screen.getByRole("group", { name: "Nivel 3" })).getByRole("button", { name: /Pedro Ruiz/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Guardar (1)" })).toBeEnabled();
    });

    it("guarda lo colocado en el tablero", async () => {
      const user = userEvent.setup();
      await renderLoadedBoard();
      await user.click(screen.getByRole("button", { name: /Pedro Ruiz/ }));
      await user.click(within(screen.getByRole("group", { name: "Nivel 3" })).getAllByRole("button")[0]);

      await user.click(screen.getByRole("button", { name: "Guardar (1)" }));

      await waitFor(() =>
        expect(createTeamTraitRatings).toHaveBeenCalledWith(
          "team-1",
          expect.objectContaining({
            ratings: [expect.objectContaining({ teamPlayerId: "pedro", levels: [{ traitKey: "traitOccupiesZone", level: 3 }] })],
          }),
        ),
      );
    });

    it("los cambios del tablero se ven en la tarjeta del jugador", async () => {
      const user = userEvent.setup();
      await renderLoadedBoard();
      await user.click(screen.getByRole("button", { name: /Pedro Ruiz/ }));
      await user.click(within(screen.getByRole("group", { name: "Nivel 3" })).getAllByRole("button")[0]);

      await user.click(screen.getByRole("button", { name: "Por jugador" }));
      await user.click(await screen.findByRole("button", { name: /Pedro Ruiz.*1\/12/ }));

      expect(within(screen.getByRole("group", { name: "Ocupa su zona y da apoyo" })).getByRole("button", { name: /nivel 3/ })).toHaveAttribute("aria-pressed", "true");
    });

    it("conserva los cambios de la tarjeta al volver al tablero", async () => {
      const user = userEvent.setup();
      await renderLoadedPage();
      await expandPlayer(user, /Juan Pérez/);
      await user.click(within(screen.getByRole("group", { name: "Posición y cobertura" })).getByRole("button", { name: /nivel 5/ }));

      await user.click(screen.getByRole("button", { name: "Por rasgo" }));
      await user.click(await screen.findByRole("button", { name: /Posición y cobertura/ }));

      expect(within(screen.getByRole("group", { name: "Nivel 5" })).getByRole("button", { name: /Juan Pérez/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Guardar (1)" })).toBeEnabled();
    });

    it("es de solo lectura para quien no es entrenador ni administrador", async () => {
      mockUsePermissions.mockReturnValue({ roles: ["Player"] });
      await renderLoadedBoard();

      expect(screen.getByRole("button", { name: /Pedro Ruiz/ })).toBeDisabled();
      expect(screen.queryByRole("button", { name: /Guardar/ })).not.toBeInTheDocument();
    });
  });
});

