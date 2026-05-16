import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../../../../shared/components/ui/ContentLayout/ContentLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../../hooks/useTeamAndClub.tsx", () => ({
  default: vi.fn(),
}));

vi.mock("../hooks/usePreferredSelection", () => ({
  usePreferredSelection: vi.fn(() => ({
    snackbar: { open: false, severity: "info", message: "" },
    setSnackbar: vi.fn(),
  })),
}));

vi.mock("../hooks/usePlayerAutoLoad", () => ({
  usePlayerAutoLoad: vi.fn(() => ({ isPlayer: false })),
}));

vi.mock("../../../services/authService", () => ({
  coachAuthService: {
    hasRole: vi.fn(() => true),
  },
}));

import CoachDashboard from "../Dashboard";
import useTeamAndClub from "../../../hooks/useTeamAndClub.tsx";

describe("CoachDashboard auto-load", () => {
  beforeEach(() => {
    vi.clearAllMocks();

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
  });

  it("shows the full dashboard when the user has an assigned club and team", () => {
    render(
      <MemoryRouter initialEntries={["/coach/dashboard"]}>
        <CoachDashboard />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: /^Configuración$/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Clubs$/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Prep\. temporada$/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Plantilla$/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Eventos$/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Resumen de asistencias$/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Partidos$/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Rivales$/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Entrenamientos$/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Lesionados$/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Modelo de Juego$/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Sanciones$/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Lotería$/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Noticias$/i })).toBeInTheDocument();
  });
});