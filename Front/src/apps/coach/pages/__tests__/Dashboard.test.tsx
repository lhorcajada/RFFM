import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../hooks/useTeamAndClub.tsx", () => ({
  default: vi.fn(),
}));

vi.mock("../Dashboard/hooks/useDashboardSeason", () => ({
  useDashboardSeason: vi.fn(),
}));

vi.mock("../Dashboard/hooks/usePreferredSelection", () => ({
  usePreferredSelection: vi.fn(),
}));

vi.mock("../Dashboard/hooks/usePlayerAutoLoad", () => ({
  usePlayerAutoLoad: vi.fn(),
}));

vi.mock("../../services/authService", () => ({
  coachAuthService: {
    hasRole: vi.fn(() => false),
  },
}));

vi.mock("../../../../shared/hooks/useFeaturePermission", () => ({
  useFeaturePermission: vi.fn(() => ({ hasAccess: true, loading: false })),
}));

vi.mock("../Dashboard/components/hooks/useUserTeams", () => ({
  useUserTeams: vi.fn(() => ({
    teams: [],
    loading: false,
  })),
}));

import CoachDashboard from "../Dashboard/Dashboard";
import useTeamAndClub from "../../hooks/useTeamAndClub.tsx";
import { useDashboardSeason } from "../Dashboard/hooks/useDashboardSeason";
import { usePreferredSelection } from "../Dashboard/hooks/usePreferredSelection";
import { usePlayerAutoLoad } from "../Dashboard/hooks/usePlayerAutoLoad";

describe("CoachDashboard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (useTeamAndClub as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      team: null,
      teamTitleNode: null,
      clubSubtitleNode: null,
      loading: false,
    });
    (useDashboardSeason as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      selectedSeason: "",
      handleSeasonChange: vi.fn(),
    });
    (usePreferredSelection as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      hasPreferredSelection: false,
      loadingConfig: false,
      snackbar: { open: false, severity: "info", message: "" },
      setSnackbar: vi.fn(),
      handleLoadPreferred: vi.fn(),
    });
    (usePlayerAutoLoad as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isPlayer: false,
    });
  });

  it("shows configuration card but never the Club card when user has no assigned club or team", async () => {
    render(
      <MemoryRouter>
        <CoachDashboard />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByRole("link", { name: /^Configuración$/i })).toBeInTheDocument());
    expect(screen.queryByRole("link", { name: /^Club$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Plantilla$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Partidos$/i })).not.toBeInTheDocument();
  });

  it("shows configuration but never the Club card when user has an assigned club and team", async () => {
    (useTeamAndClub as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      team: {
        id: "team-1",
        name: "Equipo 1",
        club: { id: "club-1", name: "Club 1" },
      },
      teamTitleNode: <span>Equipo 1</span>,
      clubSubtitleNode: <span>Club 1</span>,
      loading: false,
    });

    render(
      <MemoryRouter>
        <CoachDashboard />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByRole("link", { name: /^Configuración$/i })).toBeInTheDocument());
    expect(screen.queryByRole("link", { name: /^Club$/i })).not.toBeInTheDocument();
  });
});
