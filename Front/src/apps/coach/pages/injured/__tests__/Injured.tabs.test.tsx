import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../../../../shared/components/ui/ContentLayout/ContentLayout", () => ({
  default: ({
    actionBar,
    children,
  }: {
    actionBar?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <>
      {actionBar}
      {children}
    </>
  ),
}));

const mockTeam = { id: "team-1", name: "Equipo 1", club: { id: "club-1" } };
vi.mock("../../../hooks/useTeamAndClub.tsx", () => ({
  default: vi.fn(() => ({
    teamTitleNode: <span>Equipo 1</span>,
    team: mockTeam,
  })),
}));

vi.mock("../../../hooks/useTeamDashboardBack", () => ({
  default: () => vi.fn(),
}));

let rolesMock: string[] = ["Coach"];
vi.mock("../../../services/authService", () => ({
  coachAuthService: {
    getRoles: () => rolesMock,
    hasRole: (role: string) => rolesMock.includes(role),
    hasPermission: vi.fn().mockReturnValue(true),
    getToken: vi.fn().mockReturnValue("fake-token"),
    isAuthenticated: vi.fn().mockReturnValue(true),
  },
}));

vi.mock("../components/InjuredPlayersList", () => ({
  default: ({ isCoach }: { isCoach: boolean }) => (
    <div data-testid="panel-lesionados">Lesionados panel (coach={String(isCoach)})</div>
  ),
}));

vi.mock("../components/InjuryProtocolPanel", () => ({
  default: () => <div data-testid="panel-protocolo">Protocolo panel</div>,
}));

vi.mock("../components/InjuryProtocolDocuments", () => ({
  default: () => <div data-testid="panel-documentos">Documentos panel</div>,
}));

import Injured from "../Injured";

function renderPage() {
  render(
    <MemoryRouter>
      <Injured />
    </MemoryRouter>
  );
}

describe("Injured - pestañas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rolesMock = ["Coach"];
  });

  it("muestra la pestaña Lesionados por defecto", async () => {
    renderPage();

    expect(await screen.findByTestId("panel-lesionados")).toBeInTheDocument();
    expect(screen.queryByTestId("panel-protocolo")).not.toBeInTheDocument();
    expect(screen.queryByTestId("panel-documentos")).not.toBeInTheDocument();
  });

  it("cambia a la pestaña Protocolo y renderiza su panel", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    renderPage();

    await screen.findByTestId("panel-lesionados");
    await userEvent.click(screen.getByRole("tab", { name: /protocolo/i }));

    await waitFor(() => expect(screen.getByTestId("panel-protocolo")).toBeInTheDocument());
    expect(screen.queryByTestId("panel-lesionados")).not.toBeInTheDocument();
  });

  it("cambia a la pestaña Documentos y renderiza su panel", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    renderPage();

    await screen.findByTestId("panel-lesionados");
    await userEvent.click(screen.getByRole("tab", { name: /documentos/i }));

    await waitFor(() => expect(screen.getByTestId("panel-documentos")).toBeInTheDocument());
    expect(screen.queryByTestId("panel-lesionados")).not.toBeInTheDocument();
  });

  it("las 3 pestañas están disponibles para un rol no-coach", async () => {
    rolesMock = ["Player"];
    renderPage();

    expect(screen.getByRole("tab", { name: /lesionados/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /protocolo/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /documentos/i })).toBeInTheDocument();
  });

  it("agrupa las pestañas en un tablist accesible con 3 pestañas", () => {
    renderPage();

    const tablist = screen.getByRole("tablist");
    expect(within(tablist).getAllByRole("tab")).toHaveLength(3);
  });

  it("marca Lesionados como pestaña seleccionada por defecto", () => {
    renderPage();

    expect(screen.getByRole("tab", { name: /lesionados/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /protocolo/i })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: /documentos/i })).toHaveAttribute("aria-selected", "false");
  });

  it("al pulsar Documentos pasa a ser la única pestaña seleccionada", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    renderPage();

    await userEvent.click(screen.getByRole("tab", { name: /documentos/i }));

    expect(screen.getByRole("tab", { name: /documentos/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /lesionados/i })).toHaveAttribute("aria-selected", "false");
  });
});
