import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameModel as GameModelType } from "../../../types/gameModel";

vi.mock("../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../../../../shared/components/ui/ContentLayout/ContentLayout", () => ({
  default: ({
    actionBar,
    children,
  }: {
    actionBar?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <>
      {actionBar}
      {children}
    </>
  ),
}));

const mockTeam = { id: "team-1", name: "Equipo 1", club: { id: "club-1" } };
vi.mock("../../../hooks/useTeamAndClub", () => ({
  default: vi.fn(() => ({
    teamTitleNode: <span>Equipo 1</span>,
    clubSubtitleNode: <span>Club 1</span>,
    team: mockTeam,
  })),
}));

const mockGoToTeamDashboard = vi.fn();
vi.mock("../../../hooks/useTeamDashboardBack", () => ({
  default: () => mockGoToTeamDashboard,
}));

vi.mock("../components/ScenarioAccordion", () => ({
  default: ({ zoneName }: { zoneName: string }) => <div>Escenarios de {zoneName}</div>,
}));

vi.mock("../components/GameModelPrintView", () => ({
  default: () => <div data-testid="print-view" />,
}));

const mockGetSeasonsByTeamId = vi.fn();
const mockGetByTeamIdAndSeason = vi.fn();
vi.mock("../../../services/gameModelService", () => ({
  default: {
    getSeasonsByTeamId: (...args: unknown[]) => mockGetSeasonsByTeamId(...args),
    getByTeamIdAndSeason: (...args: unknown[]) => mockGetByTeamIdAndSeason(...args),
    delete: vi.fn(),
  },
}));

vi.mock("../../../services/seasonService", () => ({
  default: {
    getSeasons: vi.fn(async () => []),
    createSeason: vi.fn(),
  },
}));

import GameModel from "../GameModel";

function buildModel(): GameModelType {
  return {
    id: "gm-1",
    teamId: "team-1",
    name: "Modelo de Juego 2025/2026",
    season: "2025/2026",
    gameMoments: [
      {
        id: 1,
        name: "Fase de ataque",
        zones: [
          { id: 10, name: "Zona defensiva", scenarios: [{ id: -1 } as never] },
          { id: 11, name: "Zona media", scenarios: [] },
          { id: 12, name: "Zona ofensiva", scenarios: [{ id: -2 } as never, { id: -3 } as never] },
        ],
      },
      {
        id: 2,
        name: "Fase de defensa",
        zones: [
          { id: 20, name: "Zona propia", scenarios: [] },
        ],
      },
    ],
  };
}

async function renderPage() {
  mockGetSeasonsByTeamId.mockResolvedValue(["2025/2026"]);
  mockGetByTeamIdAndSeason.mockResolvedValue(buildModel());
  render(
    <MemoryRouter>
      <GameModel />
    </MemoryRouter>
  );
  await waitFor(() => expect(screen.getByText("Modelo de Juego 2025/2026")).toBeInTheDocument());
}

describe("GameModel — selector de fase y chips de zona", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra un selector de fase con el nombre y el número de zonas de cada fase", async () => {
    await renderPage();

    const phaseSelect = screen.getByRole("combobox", { name: /fase/i });
    expect(phaseSelect).toBeInTheDocument();
    expect(within(phaseSelect).getByText(/Fase de ataque/)).toBeInTheDocument();
    expect(within(phaseSelect).getByText(/3 zonas/)).toBeInTheDocument();

    await userEvent.click(phaseSelect);
    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getByText(/Fase de defensa/)).toBeInTheDocument();
    expect(within(listbox).getByText(/1 zona\b/)).toBeInTheDocument();
  });

  it("muestra chips de zona con el nombre y el número de escenarios", async () => {
    await renderPage();

    const zoneGroup = screen.getByRole("group", { name: "Zonas" });
    expect(within(zoneGroup).getByText("Zona defensiva")).toBeInTheDocument();
    expect(within(zoneGroup).getByText("Zona media")).toBeInTheDocument();
    expect(within(zoneGroup).getByText("Zona ofensiva")).toBeInTheDocument();

    const zoneOfensivaChip = within(zoneGroup).getByText("Zona ofensiva").closest(".MuiChip-root");
    expect(zoneOfensivaChip).not.toBeNull();
    expect(within(zoneOfensivaChip as HTMLElement).getByText("2")).toBeInTheDocument();
  });

  it("marca visualmente la zona seleccionada y muestra su contenido", async () => {
    await renderPage();

    const zoneGroup = screen.getByRole("group", { name: "Zonas" });
    const zoneDefensivaChip = within(zoneGroup).getByText("Zona defensiva").closest(".MuiChip-root") as HTMLElement;
    expect(zoneDefensivaChip).toHaveClass("MuiChip-filled");
    expect(screen.getByText("Escenarios de Zona defensiva")).toBeInTheDocument();

    const zoneMediaChip = within(zoneGroup).getByText("Zona media").closest(".MuiChip-root") as HTMLElement;
    await userEvent.click(zoneMediaChip);

    expect(screen.getByText(/No hay escenarios definidos para esta zona\./)).toBeInTheDocument();
    expect(zoneMediaChip).toHaveClass("MuiChip-filled");
    expect(zoneDefensivaChip).not.toHaveClass("MuiChip-filled");
  });

  it("al cambiar de fase, la zona seleccionada vuelve a ser la primera de la nueva fase", async () => {
    await renderPage();

    let zoneGroup = screen.getByRole("group", { name: "Zonas" });
    const zoneOfensivaChip = within(zoneGroup).getByText("Zona ofensiva").closest(".MuiChip-root") as HTMLElement;
    await userEvent.click(zoneOfensivaChip);
    expect(screen.getByText("Escenarios de Zona ofensiva")).toBeInTheDocument();

    const phaseSelect = screen.getByRole("combobox", { name: /fase/i });
    await userEvent.click(phaseSelect);
    const listbox = screen.getByRole("listbox");
    await userEvent.click(within(listbox).getByText(/Fase de defensa/));

    zoneGroup = screen.getByRole("group", { name: "Zonas" });
    expect(within(zoneGroup).getByText("Zona propia")).toBeInTheDocument();
    expect(within(zoneGroup).queryByText("Zona ofensiva")).not.toBeInTheDocument();

    const zonaPropiaChip = within(zoneGroup).getByText("Zona propia").closest(".MuiChip-root") as HTMLElement;
    expect(zonaPropiaChip).toHaveClass("MuiChip-filled");
  });

  it("el botón Volver navega al dashboard del equipo actual, no al dashboard general", async () => {
    await renderPage();

    await userEvent.click(screen.getByRole("button", { name: /volver/i }));

    expect(mockGoToTeamDashboard).toHaveBeenCalledTimes(1);
  });
});
