import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { exportMock, getModelMock } = vi.hoisted(() => ({ exportMock: vi.fn(), getModelMock: vi.fn() }));

vi.mock("../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("../../../../../shared/components/ui/ContentLayout/ContentLayout", () => ({
  default: ({ actionBar, children }: { actionBar?: React.ReactNode; children: React.ReactNode }) => (
    <>
      {actionBar}
      {children}
    </>
  ),
}));
vi.mock("../../../hooks/useTeamAndClub", () => ({
  default: () => ({ teamTitleNode: <span>Equipo 1</span>, team: { id: "team-1", name: "Cadete B" } }),
}));
vi.mock("../../../hooks/useTeamDashboardBack", () => ({ default: () => vi.fn() }));
vi.mock("../../../services/gameModelService", () => ({
  default: {
    getSeasonsByTeamId: vi.fn().mockResolvedValue(["2026/2027"]),
    getByTeamIdAndSeason: getModelMock,
    delete: vi.fn(),
  },
}));
vi.mock("../../../services/seasonService", () => ({
  default: { getSeasons: vi.fn(async () => []), createSeason: vi.fn() },
}));
vi.mock("../../../../../shared/hooks/usePermissions", () => ({
  usePermissions: () => ({ loading: false, roles: ["Coach"], featurePermissions: [], hasFeatureAccess: vi.fn(() => true) }),
}));
vi.mock("../gameModelPdfExport", () => ({ exportGameModelPdf: exportMock }));

import GameModel from "../GameModel";

const model = {
  id: "gm-1",
  teamId: "team-1",
  name: "Modelo Cadete B",
  season: "2026/2027",
  principles: [],
  setPieceRules: [],
  openIssues: [],
};

describe("GameModel — PDF como documento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getModelMock.mockResolvedValue(model);
  });

  it("Descargar PDF genera el documento con el modelo y el nombre del equipo, sin imprimir la pantalla", async () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    render(
      <MemoryRouter>
        <GameModel />
      </MemoryRouter>,
    );

    await userEvent.click(await screen.findByRole("button", { name: /descargar pdf/i }));

    expect(exportMock).toHaveBeenCalledWith(model, "Cadete B");
    expect(printSpy).not.toHaveBeenCalled();
  });
});
