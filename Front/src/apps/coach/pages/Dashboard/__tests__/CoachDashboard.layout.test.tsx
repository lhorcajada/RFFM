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

vi.mock("../../../../../shared/hooks/useAuditPageAccess", () => ({
  useAuditPageAccess: vi.fn(),
}));

const mockUseMediaQuery = vi.fn();
vi.mock("@mui/material/useMediaQuery", () => ({
  default: (...args: unknown[]) => mockUseMediaQuery(...args),
}));

const mockUseTeamAndClub = vi.fn();
vi.mock("../../../hooks/useTeamAndClub.tsx", () => ({
  default: () => mockUseTeamAndClub(),
}));

const mockUseGreetingName = vi.fn();
vi.mock("../hooks/useGreetingName", () => ({
  useGreetingName: () => mockUseGreetingName(),
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

vi.mock("../hooks/useUserTeams", () => ({
  useUserTeams: vi.fn(() => ({
    teams: [
      {
        id: "t1",
        name: "Alevín A",
        category: { id: 1, name: "Alevín F7" },
        league: {},
        club: { id: "c1", name: "CD Barrio", country: { id: 1, name: "España", code: "ES" } },
        canEdit: true,
        standardHalfDurationMinutes: null,
      },
    ],
    loading: false,
    error: null,
  })),
}));

vi.mock("../hooks/useTeamPhotos", () => ({ useTeamPhotos: () => ({}) }));

vi.mock("../../../../../shared/hooks/usePermissions", () => ({
  usePermissions: vi.fn(() => ({ loading: false, hasFeatureAccess: () => true })),
}));

vi.mock("../../../hooks/usePushActivationStatus", () => ({
  usePushActivationStatus: () => ({ shouldPrompt: true }),
}));

import CoachDashboard from "../Dashboard";

const preferredTeam = {
  id: "team-7",
  name: "Infantil B",
  category: { id: 3, name: "Infantil F11" },
  league: {},
  club: { id: "c1", name: "CD Barrio", country: { id: 1, name: "España", code: "ES" } },
  canEdit: true,
  standardHalfDurationMinutes: null,
};

function simulateViewport(width: number) {
  mockUseMediaQuery.mockImplementation((query: string) => {
    const max = /max-width:\s*([\d.]+)px/.exec(query);
    if (max) return width <= Number(max[1]);
    const min = /min-width:\s*([\d.]+)px/.exec(query);
    if (min) return width >= Number(min[1]);
    return false;
  });
}

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={["/coach/dashboard"]}>
      <CoachDashboard />
    </MemoryRouter>,
  );
}

describe("CoachDashboard — rediseño del panel de inicio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    simulateViewport(1440);
    mockUseGreetingName.mockReturnValue("Lucía");
    mockUseTeamAndClub.mockReturnValue({
      team: preferredTeam,
      teamTitleNode: null,
      clubSubtitleNode: null,
      teamImageUrl: null,
      clubEmblemUrl: null,
      loading: false,
    });
  });

  it("saluda al usuario logueado por su nombre", () => {
    renderDashboard();

    expect(screen.getByRole("heading", { level: 1, name: "Hola, Lucía" })).toBeInTheDocument();
  });

  it("muestra «Panel de control» como título cuando el usuario no tiene nombre", () => {
    mockUseGreetingName.mockReturnValue(null);

    renderDashboard();

    expect(screen.getByRole("heading", { level: 1, name: "Panel de control" })).toBeInTheDocument();
  });

  it("muestra el equipo preferido con el enlace a su panel", () => {
    renderDashboard();

    expect(screen.getByRole("region", { name: /equipo preferido/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /abrir panel/i })).toHaveAttribute(
      "href",
      "/coach/team-dashboard?teamId=team-7",
    );
  });

  it("no muestra el bloque de equipo preferido cuando no hay equipo", () => {
    mockUseTeamAndClub.mockReturnValue({
      team: null,
      teamTitleNode: null,
      clubSubtitleNode: null,
      teamImageUrl: null,
      clubEmblemUrl: null,
      loading: false,
    });

    renderDashboard();

    expect(screen.queryByRole("region", { name: /equipo preferido/i })).not.toBeInTheDocument();
  });

  it("en escritorio muestra la rejilla de acceso rápido, el aviso como tarjeta y «Volver al inicio»", () => {
    renderDashboard();

    expect(screen.getByRole("list", { name: /acceso rápido/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /no te pierdas nada/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /volver al inicio/i })).toBeInTheDocument();
  });

  it("en tablet muestra la rejilla de acceso rápido y el aviso como franja", () => {
    simulateViewport(834);

    renderDashboard();

    expect(screen.getByRole("list", { name: /acceso rápido/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Activar notificaciones" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /no te pierdas nada/i })).not.toBeInTheDocument();
  });

  it("en móvil muestra la lista de equipos, la fila de notificaciones y el botón Inicio", () => {
    simulateViewport(390);

    renderDashboard();

    expect(screen.getByRole("list", { name: /mis equipos/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Activar notificaciones de convocatorias" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Inicio$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /volver al inicio/i })).not.toBeInTheDocument();
  });
});
