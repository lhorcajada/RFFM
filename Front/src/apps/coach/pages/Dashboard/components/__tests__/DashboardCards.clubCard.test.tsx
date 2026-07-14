import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../hooks/useUserTeams", () => ({ useUserTeams: () => ({ teams: [], loading: false }) }));
vi.mock("../../../../../shared/services/imageService", () => ({ fetchImage: vi.fn() }));
vi.mock("../../../services/teamService", () => ({ default: {} }));
vi.mock("../../../services/clubService", () => ({ default: {} }));
vi.mock("../../../../../../shared/hooks/usePermissions", () => ({
  usePermissions: () => ({ loading: false, hasFeatureAccess: () => true }),
}));

import DashboardCards from "../DashboardCards";

describe("DashboardCards — tarjeta Club (entrenador)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("nunca renderiza la tarjeta Club para un entrenador", () => {
    render(<MemoryRouter><DashboardCards selectedSeason="" /></MemoryRouter>);
    expect(screen.queryByText("Club")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Club$/i })).not.toBeInTheDocument();
  });

  it("sigue renderizando la tarjeta Configuración y no deja huecos en el grid", () => {
    render(<MemoryRouter><DashboardCards selectedSeason="" /></MemoryRouter>);
    expect(screen.getByRole("link", { name: /^Configuración$/i })).toBeInTheDocument();
  });
});
