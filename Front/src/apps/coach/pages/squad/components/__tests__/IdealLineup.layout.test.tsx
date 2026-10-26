import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const { getFormationsMock, getIdealLineupMock } = vi.hoisted(() => ({
  getFormationsMock: vi.fn(),
  getIdealLineupMock: vi.fn(),
}));

vi.mock("../../../../services/formationService", () => ({
  __esModule: true,
  getFormations: getFormationsMock,
}));

vi.mock("../../../../services/idealLineupService", () => ({
  __esModule: true,
  getIdealLineup: getIdealLineupMock,
  saveIdealLineup: vi.fn(),
}));

import IdealLineup from "../IdealLineup";
import type { SquadPlayer } from "../IdealLineup";

const players: SquadPlayer[] = [
  { id: "p1", displayName: "Ana Lopez", position: "Portero", dorsal: 1, competitiveness: 80 },
  { id: "p2", displayName: "Beto Ruiz", position: "Delantero", dorsal: 9, competitiveness: 70, isInjured: true },
];

function renderLineup(props: Partial<React.ComponentProps<typeof IdealLineup>> = {}) {
  return render(
    <MemoryRouter>
      <IdealLineup players={players} teamId="team-1" {...props} />
    </MemoryRouter>,
  );
}

describe("IdealLineup — maquetación", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getFormationsMock.mockResolvedValue([
      { id: "f1", name: "4-4-2" },
      { id: "f2", name: "4-3-3" },
    ]);
    getIdealLineupMock.mockResolvedValue(null);
  });

  it("muestra el selector de sistema como botones y marca el elegido como pulsado", async () => {
    renderLineup();

    const first = await screen.findByRole("button", { name: "4-4-2" });
    expect(first).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "4-3-3" })).toHaveAttribute("aria-pressed", "false");
  });

  it("al pulsar otro sistema pasa a estar pulsado", async () => {
    const user = userEvent.setup();
    renderLineup();

    await user.click(await screen.findByRole("button", { name: "4-3-3" }));

    expect(screen.getByRole("button", { name: "4-3-3" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "4-4-2" })).toHaveAttribute("aria-pressed", "false");
  });

  it("lista a los jugadores disponibles con su recuento", async () => {
    renderLineup();

    const panel = await screen.findByRole("region", { name: "Jugadores disponibles" });
    expect(within(panel).getByText("Ana Lopez")).toBeInTheDocument();
    expect(within(panel).getByText("Beto Ruiz")).toBeInTheDocument();
  });

  it("usa el título del panel que le pasa el consumidor (pestaña de convocatoria)", async () => {
    renderLineup({ panelTitle: "Banquillo" });

    expect(await screen.findByRole("region", { name: "Banquillo" })).toBeInTheDocument();
  });

  it("sigue mostrando el panel extra que le pasa el consumidor", async () => {
    renderLineup({ extraPanel: <div>Panel extra</div> });

    expect(await screen.findByText("Panel extra")).toBeInTheDocument();
  });
});
