import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../hooks/useUserTeams", () => ({ useUserTeams: () => ({ teams: [], loading: false }) }));
vi.mock("../../../../../shared/services/imageService", () => ({ fetchImage: vi.fn() }));
vi.mock("../../../services/teamService", () => ({ default: {} }));
vi.mock("../../../services/clubService", () => ({ default: {} }));

const mockUsePermissions = vi.fn();
vi.mock("../../../../../../shared/hooks/usePermissions", () => ({
  usePermissions: () => mockUsePermissions(),
}));

import DashboardCards from "../DashboardCards";

describe("DashboardCards — tarjeta Configuración (permission-driven)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the Configuración card when the caller has access to /coach/settings", () => {
    mockUsePermissions.mockReturnValue({
      loading: false,
      hasFeatureAccess: (route: string) => route === "/coach/settings",
    });

    render(
      <MemoryRouter>
        <DashboardCards selectedSeason="" />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /^Configuración$/i })).toBeInTheDocument();
  });

  it("does not render the Configuración card when the caller lacks access to /coach/settings", () => {
    mockUsePermissions.mockReturnValue({
      loading: false,
      hasFeatureAccess: () => false,
    });

    render(
      <MemoryRouter>
        <DashboardCards selectedSeason="" />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link", { name: /^Configuración$/i })).not.toBeInTheDocument();
  });
});
