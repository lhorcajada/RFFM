import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../../../../../shared/components/ui/ContentLayout/ContentLayout", () => ({
  default: ({
    actionBar,
    children,
  }: {
    actionBar?: React.ReactNode;
    children?: React.ReactNode;
  }) => (
    <div>
      <div>{actionBar}</div>
      <div>{children}</div>
    </div>
  ),
}));

vi.mock("../../../../services/teamplayerService", () => ({
  getTeamPlayerById: vi.fn().mockResolvedValue({
    id: "tp-1",
    playerId: "player-1",
    teamId: "team-1",
    player: {
      name: "Juan",
      lastName: "Pérez",
      dorsal: 9,
      urlPhoto: null,
      photoUrl: null,
    },
    dorsal: 9,
    demarcation: { activePositionName: "Delantero" },
  }),
  getPlayersByTeam: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../../services/playerService", () => ({
  fetchPlayerPhoto: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../../../services/playerRatingService", () => ({
  getRatingHistory: vi.fn().mockResolvedValue([]),
  getTeamLatestRatings: vi.fn().mockResolvedValue([]),
  createRating: vi.fn().mockResolvedValue({}),
}));

const mockUsePermissions = vi.fn();
vi.mock("../../../../../../shared/hooks/usePermissions", () => ({
  usePermissions: () => mockUsePermissions(),
}));

import NewRatingPage from "../NewRatingPage";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/coach/squad/player-1/rating/new"]}>
      <Routes>
        <Route path="/coach/squad/:playerId/rating/new" element={<NewRatingPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("NewRatingPage — visibilidad del botón Guardar según rol", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no muestra el botón Guardar para el rol Player", async () => {
    mockUsePermissions.mockReturnValue({ roles: ["Player"], loading: false });

    renderPage();

    await waitFor(() => {
      expect(screen.queryByText("Juan Pérez")).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: /guardar/i })).not.toBeInTheDocument();
  });

  it("no muestra el botón Guardar para el rol FamilyMember", async () => {
    mockUsePermissions.mockReturnValue({ roles: ["FamilyMember"], loading: false });

    renderPage();

    await waitFor(() => {
      expect(screen.queryByText("Juan Pérez")).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: /guardar/i })).not.toBeInTheDocument();
  });

  it("muestra el botón Guardar para el rol Coach", async () => {
    mockUsePermissions.mockReturnValue({ roles: ["Coach"], loading: false });

    renderPage();

    await waitFor(() => {
      expect(screen.queryByText("Juan Pérez")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /guardar/i })).toBeInTheDocument();
  });

  it("muestra el botón Guardar para el rol Administrator", async () => {
    mockUsePermissions.mockReturnValue({ roles: ["Administrator"], loading: false });

    renderPage();

    await waitFor(() => {
      expect(screen.queryByText("Juan Pérez")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /guardar/i })).toBeInTheDocument();
  });
});
