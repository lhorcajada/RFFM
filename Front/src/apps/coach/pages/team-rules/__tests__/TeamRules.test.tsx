import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TeamRulesDto } from "../../../services/teamRulesService";

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
vi.mock("../../../hooks/useTeamAndClub", () => ({
  default: vi.fn(() => ({
    teamTitleNode: <span>Equipo 1</span>,
    clubSubtitleNode: <span>Club 1</span>,
    team: mockTeam,
  })),
}));

const mockGoToTeamDashboard = vi.fn();
vi.mock("../../../hooks/useTeamDashboardBack", () => ({
  default: () => mockGoToTeamDashboard,
}));

const mockGetTeamRules = vi.fn();
const mockDeleteTeamRules = vi.fn();
vi.mock("../../../services/teamRulesService", () => ({
  default: {
    getTeamRules: (...args: unknown[]) => mockGetTeamRules(...args),
    deleteTeamRules: (...args: unknown[]) => mockDeleteTeamRules(...args),
  },
}));

const mockHasFeatureAccess = vi.fn(() => true);
let mockFeaturePermissions: { featureRoute: string; permissionType: string }[] = [];
let mockRoles: string[] = ["Coach"];
vi.mock("../../../../../shared/hooks/usePermissions", () => ({
  usePermissions: () => ({
    loading: false,
    roles: mockRoles,
    featurePermissions: mockFeaturePermissions,
    hasFeatureAccess: mockHasFeatureAccess,
  }),
}));

import TeamRules from "../TeamRules";

function buildRulesDto(): TeamRulesDto {
  return {
    teamId: "team-1",
    title: "NORMAS DE EQUIPO",
    subtitle: "Compromiso, respeto y equipo",
    introNote: "Nota inicial de las normas.",
    closingNote: "Nota sobre el fondo del equipo.",
    applicationNote: "Nota sobre aplicación de las normas.",
    rules: [
      {
        id: "rule-1",
        order: 1,
        shortTitle: "Asistencia y preparación",
        highlight: "Entrenar suma preparación, compromiso y prioridad deportiva.",
        violationSummary: "No entrenar, entrenar solo un día o faltar parte de la pretemporada.",
        consequenceSummary: "Podrá afectar a la convocatoria, minutos o prioridad deportiva.",
        longDescription: "El equipo entrena dos días a la semana.",
        bulletPoints: ["Asistencia semanal", "Ausencias justificadas"],
        consequenceDetail: null,
      },
      {
        id: "rule-2",
        order: 2,
        shortTitle: "Puntualidad",
        highlight: null,
        violationSummary: "Llegar tarde sin justificación.",
        consequenceSummary: "Aportar 1€ al fondo del equipo.",
        longDescription: null,
        bulletPoints: null,
        consequenceDetail: "Si llega tarde sin justificación, deberá aportar 1€.",
      },
    ],
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

function renderPage() {
  render(
    <MemoryRouter>
      <TeamRules />
    </MemoryRouter>
  );
}

describe("TeamRules — vista de lectura", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRoles = ["Coach"];
    mockFeaturePermissions = [{ featureRoute: "/mobile/team-rules", permissionType: "ReadWrite" }];
  });

  it("muestra un indicador de carga mientras se obtienen las normas", async () => {
    mockGetTeamRules.mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("muestra un estado vacío cuando el equipo todavía no tiene normas", async () => {
    mockGetTeamRules.mockResolvedValue(null);
    renderPage();

    await waitFor(() => expect(screen.getByText(/Aún no disponible/i)).toBeInTheDocument());
  });

  it("renderiza las normas en orden con todos sus campos", async () => {
    mockGetTeamRules.mockResolvedValue(buildRulesDto());
    renderPage();

    await waitFor(() => expect(screen.getByText("NORMAS DE EQUIPO")).toBeInTheDocument());

    expect(screen.getByText("Compromiso, respeto y equipo")).toBeInTheDocument();
    expect(screen.getByText("Nota inicial de las normas.")).toBeInTheDocument();

    const ruleTitles = screen.getAllByText(/Asistencia y preparación|Puntualidad/);
    expect(ruleTitles[0]).toHaveTextContent("Asistencia y preparación");
    expect(ruleTitles[1]).toHaveTextContent("Puntualidad");

    expect(screen.getByText(/Entrenar suma preparación/)).toBeInTheDocument();
    expect(screen.getByText(/No entrenar, entrenar solo un día/)).toBeInTheDocument();
    expect(screen.getByText(/Podrá afectar a la convocatoria/)).toBeInTheDocument();
    expect(screen.getByText("El equipo entrena dos días a la semana.")).toBeInTheDocument();
    expect(screen.getByText("Asistencia semanal")).toBeInTheDocument();

    expect(screen.getByText(/Llegar tarde sin justificación\./)).toBeInTheDocument();
    expect(screen.getByText(/Si llega tarde sin justificación, deberá aportar 1€\./)).toBeInTheDocument();

    expect(screen.getByText("Nota sobre el fondo del equipo.")).toBeInTheDocument();
    expect(screen.getByText("Nota sobre aplicación de las normas.")).toBeInTheDocument();
  });

  it("muestra los controles Editar/Eliminar cuando el entrenador tiene permiso ReadWrite", async () => {
    mockFeaturePermissions = [{ featureRoute: "/mobile/team-rules", permissionType: "ReadWrite" }];
    mockGetTeamRules.mockResolvedValue(buildRulesDto());
    renderPage();

    await waitFor(() => expect(screen.getByText("NORMAS DE EQUIPO")).toBeInTheDocument());

    expect(screen.getByRole("button", { name: /editar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /eliminar/i })).toBeInTheDocument();
  });

  it("oculta los controles Editar/Eliminar cuando el entrenador no tiene permiso ReadWrite", async () => {
    mockFeaturePermissions = [{ featureRoute: "/mobile/team-rules", permissionType: "Read" }];
    mockGetTeamRules.mockResolvedValue(buildRulesDto());
    renderPage();

    await waitFor(() => expect(screen.getByText("NORMAS DE EQUIPO")).toBeInTheDocument());

    expect(screen.queryByRole("button", { name: /editar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /eliminar/i })).not.toBeInTheDocument();
  });

  it("el botón Volver navega al dashboard del equipo actual", async () => {
    mockGetTeamRules.mockResolvedValue(null);
    renderPage();

    await waitFor(() => expect(screen.getByText(/Aún no disponible/i)).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /volver/i }));

    expect(mockGoToTeamDashboard).toHaveBeenCalledTimes(1);
  });

  it("el flujo de eliminar pide confirmación y llama a deleteTeamRules", async () => {
    mockGetTeamRules.mockResolvedValue(buildRulesDto());
    mockDeleteTeamRules.mockResolvedValue(undefined);
    renderPage();

    await waitFor(() => expect(screen.getByText("NORMAS DE EQUIPO")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /eliminar/i }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: /eliminar/i }));

    await waitFor(() => expect(mockDeleteTeamRules).toHaveBeenCalledWith("team-1"));
  });
});
