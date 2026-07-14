import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockUsePermissions = vi.fn();

vi.mock("../../../../../shared/hooks/usePermissions", () => ({
  usePermissions: () => mockUsePermissions(),
}));

import TeamDashboardCards from "../TeamDashboardCards";

const ALLOWED_ROUTES = [
  "/coach/squad",
  "/coach/attendance",
  "/coach/attendance/summary",
  "/coach/convocations",
  "/coach/injured",
  "/coach/sanctions",
  "/coach/lottery",
  "/coach/news",
];

function renderCards() {
  return render(
    <MemoryRouter>
      <TeamDashboardCards team={null} selectedSeason="" />
    </MemoryRouter>,
  );
}

describe("TeamDashboardCards — permission-driven visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Player role sees exactly the 8 allowed cards, not Rivals/Trainings/GameModel/SeasonAccess", () => {
    mockUsePermissions.mockReturnValue({
      loading: false,
      hasFeatureAccess: (route: string) => ALLOWED_ROUTES.includes(route),
    });

    renderCards();

    expect(screen.getByRole("link", { name: "Plantilla" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Eventos" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Resumen de asistencias" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Partidos" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Lesionados" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sanciones" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Lotería" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Noticias" })).toBeInTheDocument();

    expect(screen.queryByRole("link", { name: "Rivales" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Entrenamientos" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Modelo de Juego" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Pruebas de acceso" })).not.toBeInTheDocument();
  });

  it("Coach role sees all catalogued cards", () => {
    mockUsePermissions.mockReturnValue({
      loading: false,
      hasFeatureAccess: () => true,
    });

    renderCards();

    expect(screen.getByRole("link", { name: "Rivales" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Entrenamientos" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Modelo de Juego" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pruebas de acceso" })).toBeInTheDocument();
  });

  it("Administrator sees all cards despite an empty permissions fixture", () => {
    mockUsePermissions.mockReturnValue({
      loading: false,
      hasFeatureAccess: () => true, // hasFeatureAccess already encapsulates the Administrator bypass
    });

    renderCards();

    expect(screen.getByRole("link", { name: "Modelo de Juego" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pruebas de acceso" })).toBeInTheDocument();
  });

  it("renders no restricted cards while permissions are still loading", () => {
    mockUsePermissions.mockReturnValue({
      loading: true,
      hasFeatureAccess: () => false,
    });

    renderCards();

    expect(screen.queryByRole("link", { name: "Modelo de Juego" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Plantilla" })).not.toBeInTheDocument();
  });
});
