import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../hooks/useUserTeams", () => ({ useUserTeams: () => ({ teams: [], loading: false }) }));
vi.mock("../../../../../shared/services/imageService", () => ({ fetchImage: vi.fn() }));
vi.mock("../../../services/teamService", () => ({ default: {} }));
vi.mock("../../../services/clubService", () => ({ default: {} }));
const mockHasFeatureAccess = vi.fn();
vi.mock("../../../../../../shared/hooks/usePermissions", () => ({
  usePermissions: () => ({ loading: false, hasFeatureAccess: mockHasFeatureAccess }),
}));

import DashboardCards from "../DashboardCards";

describe("DashboardCards — tarjeta Club (entrenador)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasFeatureAccess.mockReturnValue(true);
  });

  it("renderiza la tarjeta Club cuando el usuario tiene acceso a la gestión de club", () => {
    render(<MemoryRouter><DashboardCards selectedSeason="" /></MemoryRouter>);
    expect(screen.getByRole("link", { name: /Club/i })).toHaveAttribute("href", "/coach/clubs");
  });

  it("no renderiza la tarjeta Club cuando el usuario no tiene acceso a la gestión de club", () => {
    mockHasFeatureAccess.mockImplementation((route: string) => route !== "/coach/clubs");
    render(<MemoryRouter><DashboardCards selectedSeason="" /></MemoryRouter>);
    expect(screen.queryByRole("link", { name: /Club/i })).not.toBeInTheDocument();
  });

  it("sigue renderizando la tarjeta Configuración y no deja huecos en el grid", () => {
    render(<MemoryRouter><DashboardCards selectedSeason="" /></MemoryRouter>);
    expect(screen.getByRole("link", { name: /^Configuración$/i })).toBeInTheDocument();
  });
});
