import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

const permissions = vi.hoisted(() => ({ hasFeatureAccess: vi.fn() }));

vi.mock("../../../../../../../shared/hooks/usePermissions", () => ({
  usePermissions: () => ({ loading: false, hasFeatureAccess: permissions.hasFeatureAccess }),
}));

import ClubQuickActions from "../ClubQuickActions";

const renderActions = (props: { seasonId?: string; pendingRequests?: number } = {}) =>
  render(
    <MemoryRouter>
      <ClubQuickActions clubId="club-1" {...props} />
    </MemoryRouter>,
  );

describe("ClubQuickActions", () => {
  beforeEach(() => {
    permissions.hasFeatureAccess.mockReturnValue(true);
  });

  it("enlaza cada acción con su destino", () => {
    renderActions();

    const href = (name: RegExp) => screen.getByRole("link", { name }).getAttribute("href");
    expect(href(/^Equipos/)).toBe("/coach/clubs/club-1/teams");
    expect(href(/^Jugadores/)).toBe("/coach/clubs/club-1/players");
    expect(href(/^Personal/)).toBe("/scope/members?scope=club&id=club-1");
    expect(href(/^Inscripciones/)).toBe("/coach/clubs/club-1/registrations");
    expect(href(/^Solicitudes de acceso/)).toBe("/club-join-requests?clubId=club-1");
    expect(href(/^Nuevo equipo/)).toBe("/coach/clubs/club-1/teams/new");
  });

  it("conserva la temporada en equipos, jugadores e inscripciones", () => {
    renderActions({ seasonId: "s-9" });

    expect(screen.getByRole("link", { name: /^Equipos/ })).toHaveAttribute(
      "href",
      "/coach/clubs/club-1/teams?seasonId=s-9",
    );
    expect(screen.getByRole("link", { name: /^Jugadores/ })).toHaveAttribute(
      "href",
      "/coach/clubs/club-1/players?seasonId=s-9",
    );
    expect(screen.getByRole("link", { name: /^Inscripciones/ })).toHaveAttribute(
      "href",
      "/coach/clubs/club-1/registrations?seasonId=s-9",
    );
  });

  it("oculta Equipos y Nuevo equipo sin acceso a los equipos del club", () => {
    permissions.hasFeatureAccess.mockReturnValue(false);

    renderActions();

    expect(screen.queryByRole("link", { name: /^Equipos/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Nuevo equipo/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Jugadores/ })).toBeInTheDocument();
  });

  it("muestra el número de solicitudes pendientes en su acción", () => {
    renderActions({ pendingRequests: 4 });

    expect(screen.getByRole("link", { name: /Solicitudes de acceso.*4/ })).toBeInTheDocument();
  });
});
