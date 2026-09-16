import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { COACH_FEATURE_ROUTES } from "../../../constants/featureRoutes";

const mockUsePermissions = vi.fn();

vi.mock("../../../../../shared/hooks/usePermissions", () => ({
  usePermissions: () => mockUsePermissions(),
}));

import TeamDashboardCards from "../TeamDashboardCards";

function renderCards(isPlayer: boolean = false) {
  return render(
    <MemoryRouter>
      <TeamDashboardCards team={null} selectedSeason="" isPlayer={isPlayer} />
    </MemoryRouter>,
  );
}

describe("TeamDashboardCards — grouping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders each catalogued group header exactly once when every tile is visible", () => {
    mockUsePermissions.mockReturnValue({ loading: false, hasFeatureAccess: () => true });

    renderCards(false);

    expect(screen.getByText("Equipo")).toBeInTheDocument();
    expect(screen.getByText("Actividad")).toBeInTheDocument();
    expect(screen.getByText("Competición")).toBeInTheDocument();
    expect(screen.getByText("Disciplina")).toBeInTheDocument();
    expect(screen.getByText("Otros")).toBeInTheDocument();
  });

  it("places each tile after its group's header, in document order", () => {
    mockUsePermissions.mockReturnValue({ loading: false, hasFeatureAccess: () => true });

    const { container } = renderCards(false);
    const nodes = Array.from(container.querySelectorAll("h3,a")).map((el) => el.textContent);

    const equipoIndex = nodes.indexOf("Equipo");
    const plantillaIndex = nodes.indexOf("Plantilla");
    const actividadIndex = nodes.indexOf("Actividad");

    expect(equipoIndex).toBeGreaterThanOrEqual(0);
    expect(plantillaIndex).toBeGreaterThan(equipoIndex);
    expect(plantillaIndex).toBeLessThan(actividadIndex);
  });

  it("hides a group header entirely when every tile in that group is hidden", () => {
    mockUsePermissions.mockReturnValue({
      loading: false,
      hasFeatureAccess: (route: string) =>
        route !== COACH_FEATURE_ROUTES.Rivals && route !== COACH_FEATURE_ROUTES.GameModel,
    });

    renderCards(false);

    expect(screen.queryByText("Competición")).not.toBeInTheDocument();
    expect(screen.getByText("Equipo")).toBeInTheDocument();
  });

  it("keeps a group header visible when at least one of its tiles is still visible", () => {
    mockUsePermissions.mockReturnValue({ loading: false, hasFeatureAccess: () => true });

    renderCards(true); // isPlayer hides "Gestión de usuarios" but not Plantilla/Lesionados

    expect(screen.getByText("Equipo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Plantilla" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Gestión de usuarios" })).not.toBeInTheDocument();
  });
});
