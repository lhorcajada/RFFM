import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
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

vi.mock("../../../hooks/useTeamAndClub", () => ({
  default: vi.fn(() => ({
    teamTitleNode: <span>Equipo 1</span>,
    team: { id: "team-1", name: "Equipo 1", club: { id: "club-1" } },
  })),
}));

vi.mock("../components/ScenarioFormAccordion", () => ({
  default: () => <div data-testid="scenario-form-accordion" />,
}));

vi.mock("../components/MobileSaveCancelBar", () => ({
  default: () => <div data-testid="mobile-save-cancel-bar" />,
}));

const mockGetByTeamIdAndSeason = vi.fn();
const mockGetEmptyDraft = vi.fn();
vi.mock("../../../services/gameModelService", () => ({
  default: {
    getByTeamIdAndSeason: (...args: unknown[]) => mockGetByTeamIdAndSeason(...args),
    getEmptyDraft: (...args: unknown[]) => mockGetEmptyDraft(...args),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

import GameModelCreate from "../GameModelCreate";

function buildDraft(): GameModelType {
  return {
    id: "",
    teamId: "team-1",
    name: "",
    season: "2025/2026",
    gameMoments: [
      {
        id: 1,
        name: "Fase de ataque",
        zones: [
          {
            id: 10,
            name: "Zona ofensiva",
            principles: [
              { id: -1, gameMomentId: 1, gameZoneId: 10, order: 1, title: "P1", description: "", scenarios: [{ id: -1 } as never, { id: -2 } as never] } as never,
              { id: -3, gameMomentId: 1, gameZoneId: 10, order: 2, title: "P2", description: "", scenarios: [{ id: -4 } as never] } as never,
            ],
          },
        ],
      },
    ],
  };
}

async function renderPage() {
  mockGetEmptyDraft.mockResolvedValue(buildDraft());
  render(
    <MemoryRouter initialEntries={[{ pathname: "/coach/game-model/create", search: "?teamId=team-1", state: { season: "2025/2026", teamId: "team-1" } }]}>
      <GameModelCreate />
    </MemoryRouter>
  );
  expect(await screen.findByTestId("scenario-form-accordion")).toBeInTheDocument();
}

describe("GameModelCreate", () => {
  it("muestra en el chip de la pestaña de zona el número de principios, no de escenarios", async () => {
    await renderPage();

    // Zona ofensiva has 2 principles totalling 3 scenarios — the tab chip must show 2.
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.queryByText("3")).not.toBeInTheDocument();
  });
});
