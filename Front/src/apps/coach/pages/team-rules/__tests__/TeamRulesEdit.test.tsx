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

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockGetTeamRules = vi.fn();
const mockSaveTeamRules = vi.fn();
const mockDeleteTeamRules = vi.fn();
vi.mock("../../../services/teamRulesService", () => ({
  default: {
    getTeamRules: (...args: unknown[]) => mockGetTeamRules(...args),
    saveTeamRules: (...args: unknown[]) => mockSaveTeamRules(...args),
    deleteTeamRules: (...args: unknown[]) => mockDeleteTeamRules(...args),
  },
}));

import TeamRulesEdit from "../TeamRulesEdit";

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
        shortTitle: "Puntualidad",
        highlight: "Llegar a tiempo es respeto.",
        violationSummary: "Llegar tarde sin justificación.",
        consequenceSummary: "Aportar 1€ al fondo del equipo.",
        longDescription: null,
        bulletPoints: null,
        consequenceDetail: null,
      },
    ],
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

function renderPage(initialEntry: string) {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <TeamRulesEdit />
    </MemoryRouter>
  );
}

describe("TeamRulesEdit — formulario crear/editar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("en creación, los campos de metadata aparecen vacíos y sin normas", async () => {
    mockGetTeamRules.mockResolvedValue(null);
    renderPage("/coach/team-rules/edit?teamId=team-1");

    await waitFor(() => expect(screen.getByLabelText(/^título$/i)).toBeInTheDocument());

    expect(screen.getByLabelText(/^título$/i)).toHaveValue("");
    expect(screen.getByLabelText(/subtítulo/i)).toHaveValue("");
    expect(screen.queryByDisplayValue("Puntualidad")).not.toBeInTheDocument();
  });

  it("en edición, los campos de metadata y las normas aparecen prellenados", async () => {
    mockGetTeamRules.mockResolvedValue(buildRulesDto());
    renderPage("/coach/team-rules/edit?teamId=team-1");

    await waitFor(() => expect(screen.getByLabelText(/^título$/i)).toHaveValue("NORMAS DE EQUIPO"));

    expect(screen.getByLabelText(/subtítulo/i)).toHaveValue("Compromiso, respeto y equipo");
    expect(screen.getByDisplayValue("Puntualidad")).toBeInTheDocument();
  });

  it("permite añadir, quitar y reordenar normas", async () => {
    mockGetTeamRules.mockResolvedValue(buildRulesDto());
    renderPage("/coach/team-rules/edit?teamId=team-1");

    await waitFor(() => expect(screen.getByDisplayValue("Puntualidad")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /añadir norma/i }));
    const shortTitleInputs = screen.getAllByLabelText(/título corto/i);
    expect(shortTitleInputs).toHaveLength(2);

    await userEvent.type(shortTitleInputs[1], "Respeto");

    const moveDownButtons = screen.getAllByRole("button", { name: /mover abajo/i });
    await userEvent.click(moveDownButtons[0]);

    const reorderedInputs = screen.getAllByLabelText(/título corto/i);
    expect(reorderedInputs[0]).toHaveValue("Respeto");
    expect(reorderedInputs[1]).toHaveValue("Puntualidad");

    const removeButtons = screen.getAllByRole("button", { name: /quitar norma/i });
    await userEvent.click(removeButtons[0]);

    expect(screen.getAllByLabelText(/título corto/i)).toHaveLength(1);
  }, 15000);

  it("bloquea el envío si faltan campos requeridos o no hay normas", async () => {
    mockGetTeamRules.mockResolvedValue(null);
    renderPage("/coach/team-rules/edit?teamId=team-1");

    await waitFor(() => expect(screen.getByLabelText(/^título$/i)).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    expect(mockSaveTeamRules).not.toHaveBeenCalled();
    expect(screen.getAllByText(/obligatorio/i).length).toBeGreaterThan(0);
  });

  it("un envío correcto llama a saveTeamRules y navega a la vista de lectura", async () => {
    mockGetTeamRules.mockResolvedValue(buildRulesDto());
    mockSaveTeamRules.mockResolvedValue(buildRulesDto());
    renderPage("/coach/team-rules/edit?teamId=team-1");

    await waitFor(() => expect(screen.getByDisplayValue("Puntualidad")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(mockSaveTeamRules).toHaveBeenCalledWith("team-1", expect.objectContaining({
      title: "NORMAS DE EQUIPO",
      subtitle: "Compromiso, respeto y equipo",
    })));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining("/coach/team-rules")));
  });

  it("el flujo de eliminar pide confirmación y llama a deleteTeamRules", async () => {
    mockGetTeamRules.mockResolvedValue(buildRulesDto());
    mockDeleteTeamRules.mockResolvedValue(undefined);
    renderPage("/coach/team-rules/edit?teamId=team-1");

    await waitFor(() => expect(screen.getByDisplayValue("Puntualidad")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /eliminar normas/i }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: /eliminar/i }));

    await waitFor(() => expect(mockDeleteTeamRules).toHaveBeenCalledWith("team-1"));
  });
});
