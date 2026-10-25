import React from "react";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUsePermissions = vi.fn();
vi.mock("../../../../shared/hooks/usePermissions", () => ({
  usePermissions: () => mockUsePermissions(),
}));

const mockUseIsPlayerRole = vi.fn();
vi.mock("../../hooks/useIsPlayerRole", () => ({
  default: () => mockUseIsPlayerRole(),
  useIsPlayerRole: () => mockUseIsPlayerRole(),
}));

const mockUseTeamContextId = vi.fn();
vi.mock("../useTeamContextId", () => ({
  useTeamContextId: () => mockUseTeamContextId(),
}));

import CoachTeamNav from "../CoachTeamNav";

function renderNav(path = "/coach/team-dashboard") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <CoachTeamNav />
    </MemoryRouter>,
  );
  return screen.getByRole("navigation", { name: "Navegación del equipo" });
}

function tabLabels(nav: HTMLElement) {
  return within(nav)
    .getAllByRole("link")
    .map((link) => link.textContent);
}

describe("CoachTeamNav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePermissions.mockReturnValue({ loading: false, hasFeatureAccess: () => true });
    mockUseIsPlayerRole.mockReturnValue(false);
    mockUseTeamContextId.mockReturnValue("team-1");
  });

  it("muestra las pestañas del entrenador", () => {
    const nav = renderNav();

    expect(tabLabels(nav)).toEqual(["Inicio", "Calendario", "Eventos", "Entrenamientos", "Menú"]);
  });

  it("muestra las pestañas del jugador o familiar", () => {
    mockUseIsPlayerRole.mockReturnValue(true);

    const nav = renderNav();

    expect(tabLabels(nav)).toEqual(["Inicio", "Resultados", "Clasificación", "Eventos", "Menú"]);
  });

  it("enlaza las pestañas al equipo en contexto", () => {
    const nav = renderNav();

    expect(within(nav).getByRole("link", { name: "Inicio" })).toHaveAttribute(
      "href",
      "/coach/team-dashboard?teamId=team-1",
    );
    expect(within(nav).getByRole("link", { name: "Menú" })).toHaveAttribute(
      "href",
      "/coach/menu?teamId=team-1",
    );
  });

  it("marca la pestaña de la página actual con aria-current", () => {
    const nav = renderNav("/coach/attendance");

    expect(within(nav).getByRole("link", { name: "Eventos" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Inicio" })).not.toHaveAttribute("aria-current");
  });

  it("solo muestra Inicio y Menú mientras se cargan los permisos", () => {
    mockUsePermissions.mockReturnValue({ loading: true, hasFeatureAccess: () => false });

    const nav = renderNav();

    expect(tabLabels(nav)).toEqual(["Inicio", "Menú"]);
  });
});
