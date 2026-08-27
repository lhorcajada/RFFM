import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { UserProvider } from "../../../../../shared/context/UserContext";

vi.mock("../hooks/useConvocations", () => ({
  default: () => ({
    matches: [],
    loading: false,
    error: null,
    federationTeamId: "team-1",
    settingsLoading: false,
    syncing: false,
    syncSnackbar: null,
    setSyncSnackbar: vi.fn(),
    handleSyncCalendar: vi.fn(),
  }),
}));

vi.mock("../../../hooks/useTeamDashboardBack", () => ({
  default: () => vi.fn(),
}));

const getRolesMock = vi.fn();
vi.mock("../../../services/authService", () => ({
  coachAuthService: {
    getRoles: () => getRolesMock(),
    getToken: () => null,
    isAuthenticated: () => true,
  },
}));

import Convocations from "../Convocations";

function renderPage() {
  render(
    <UserProvider>
      <MemoryRouter initialEntries={["/coach/convocations?teamId=team-1"]}>
        <Convocations />
      </MemoryRouter>
    </UserProvider>
  );
}

describe("Convocations — botón Generar calendario según rol", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra el botón Generar calendario para un entrenador", () => {
    getRolesMock.mockReturnValue(["Coach"]);
    renderPage();
    expect(screen.getByRole("button", { name: /generar calendario/i })).toBeInTheDocument();
  });

  it("no muestra el botón Generar calendario para un jugador", () => {
    getRolesMock.mockReturnValue(["Player"]);
    renderPage();
    expect(screen.queryByRole("button", { name: /generar calendario/i })).not.toBeInTheDocument();
  });

  it("no muestra el botón Generar calendario para un familiar", () => {
    getRolesMock.mockReturnValue(["FamilyPlayer"]);
    renderPage();
    expect(screen.queryByRole("button", { name: /generar calendario/i })).not.toBeInTheDocument();
  });

  it("no muestra el botón Generar calendario para un seguidor", () => {
    getRolesMock.mockReturnValue(["Follower"]);
    renderPage();
    expect(screen.queryByRole("button", { name: /generar calendario/i })).not.toBeInTheDocument();
  });
});
