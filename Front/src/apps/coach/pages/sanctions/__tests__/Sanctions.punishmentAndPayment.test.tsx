import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserProvider } from "../../../../../shared/context/UserContext";

const mockTeam = { id: "team-1", name: "Team 1" };
vi.mock("../../../hooks/useTeamAndClub.tsx", () => ({
  default: () => ({
    team: mockTeam,
    teamTitleNode: null,
    clubSubtitleNode: null,
    loading: false,
  }),
}));

const getPlayersByTeamMock = vi.fn();
vi.mock("../../../services/teamplayerService", () => ({
  default: {
    getPlayersByTeam: (...args: unknown[]) => getPlayersByTeamMock(...args),
  },
}));

const getTeamSanctionsMock = vi.fn();
const createPlayerSanctionMock = vi.fn();
const updatePlayerSanctionMock = vi.fn();
const deletePlayerSanctionMock = vi.fn();
vi.mock("../../../services/teamplayerSanctionService", () => ({
  default: {
    getPlayerSanctions: vi.fn(),
    createPlayerSanction: (...args: unknown[]) => createPlayerSanctionMock(...args),
    updatePlayerSanction: (...args: unknown[]) => updatePlayerSanctionMock(...args),
    deletePlayerSanction: (...args: unknown[]) => deletePlayerSanctionMock(...args),
    getTeamSanctions: (...args: unknown[]) => getTeamSanctionsMock(...args),
  },
  getTeamSanctions: (...args: unknown[]) => getTeamSanctionsMock(...args),
  createPlayerSanction: (...args: unknown[]) => createPlayerSanctionMock(...args),
  updatePlayerSanction: (...args: unknown[]) => updatePlayerSanctionMock(...args),
  deletePlayerSanction: (...args: unknown[]) => deletePlayerSanctionMock(...args),
}));

const getSportEventsMock = vi.fn();
vi.mock("../../../services/sportEventService", () => ({
  default: { getSportEvents: (...args: unknown[]) => getSportEventsMock(...args) },
  getSportEvents: (...args: unknown[]) => getSportEventsMock(...args),
}));

vi.mock("../../../services/authService", () => ({
  coachAuthService: {
    getRoles: () => ["Coach"],
    hasRole: () => true,
    hasPermission: vi.fn().mockReturnValue(true),
    getToken: vi.fn().mockReturnValue("fake-token"),
    isAuthenticated: vi.fn().mockReturnValue(true),
  },
}));

vi.mock("../../../services/coachApi", () => ({
  getMyProfile: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../../services/teamFundService", () => ({
  default: { getTeamFund: vi.fn().mockResolvedValue({ teamId: "team-1", balance: 0, movements: [] }) },
  getTeamFund: vi.fn().mockResolvedValue({ teamId: "team-1", balance: 0, movements: [] }),
}));

vi.mock("../../../services/playerService", () => ({
  default: { fetchPlayerPhoto: vi.fn().mockResolvedValue(null) },
  fetchPlayerPhoto: vi.fn().mockResolvedValue(null),
}));

import Sanctions from "../Sanctions";

const FUTURE_EVENT_ID = "event-future";
const PAST_EVENT_ID = "event-past";

function buildPlayers() {
  return [{ id: "player-1", name: "Juan", lastName: "Pérez", alias: "Juanito", dorsal: 7 }];
}

function buildEvents() {
  const future = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  const past = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  return {
    items: [
      { id: FUTURE_EVENT_ID, name: "Jornada futura", eveDateTime: future },
      { id: PAST_EVENT_ID, name: "Jornada pasada", eveDateTime: past },
    ],
    pageNumber: 1,
    pageSize: 200,
    totalItems: 2,
    totalPages: 1,
  };
}

async function openAddDialog() {
  const addButton = await screen.findByRole("button", { name: /añadir sanción/i });
  await userEvent.click(addButton);
}

describe("Sanctions — sanción deportiva y pagos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPlayersByTeamMock.mockResolvedValue(buildPlayers());
    getSportEventsMock.mockResolvedValue(buildEvents());
    getTeamSanctionsMock.mockResolvedValue([]);
  });

  it("por defecto el tipo de sanción deportiva es Ninguno y no muestra selector de partido ni minutos", async () => {
    render(
      <UserProvider>
        <MemoryRouter>
          <Sanctions />
        </MemoryRouter>
      </UserProvider>
    );
    await waitFor(() => expect(getTeamSanctionsMock).toHaveBeenCalled());
    await openAddDialog();

    expect(screen.getByLabelText(/naturaleza/i)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /sanción deportiva/i })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /^partido$/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/límite de minutos/i)).not.toBeInTheDocument();
  });

  it("al elegir 'Límite de minutos' muestra el selector de partido y el campo de minutos", async () => {
    render(
      <UserProvider>
        <MemoryRouter>
          <Sanctions />
        </MemoryRouter>
      </UserProvider>
    );
    await waitFor(() => expect(getTeamSanctionsMock).toHaveBeenCalled());
    await openAddDialog();

    await userEvent.click(screen.getByRole("combobox", { name: /sanción deportiva/i }));
    await userEvent.click((await screen.findAllByText(/límite de minutos/i))[0]);

    expect(await screen.findByRole("combobox", { name: /^partido$/i })).toBeInTheDocument();
    expect(await screen.findByLabelText(/límite de minutos/i)).toBeInTheDocument();
  });

  it("envía sportivePunishmentType, targetEventId, minutesLimit y amountPaid al crear la sanción", async () => {
    createPlayerSanctionMock.mockResolvedValue({ id: "new-1" });

    render(
      <UserProvider>
        <MemoryRouter>
          <Sanctions />
        </MemoryRouter>
      </UserProvider>
    );
    await waitFor(() => expect(getTeamSanctionsMock).toHaveBeenCalled());
    await openAddDialog();

    // Player
    const playerField = screen.getByLabelText(/jugador/i);
    await userEvent.click(playerField);
    await userEvent.type(playerField, "Juan");
    const playerOption = await screen.findByText("Juan Pérez");
    await userEvent.click(playerOption);

    await userEvent.type(screen.getByRole("textbox", { name: "Tipo de sanción" }), "Falta de respeto");

    // Punishment type -> MinutesLimit
    await userEvent.click(screen.getByRole("combobox", { name: /sanción deportiva/i }));
    await userEvent.click((await screen.findAllByText(/límite de minutos/i))[0]);

    // Target event
    const eventField = await screen.findByRole("combobox", { name: /^partido$/i });
    await userEvent.click(eventField);
    await userEvent.click(await screen.findByText(/jornada futura/i));

    const minutesField = await screen.findByLabelText(/límite de minutos/i);
    await userEvent.clear(minutesField);
    await userEvent.type(minutesField, "20");

    const amountPaidField = screen.getByLabelText(/importe pagado/i);
    await userEvent.type(amountPaidField, "10");

    const saveButton = screen.getByRole("button", { name: /guardar/i });
    await userEvent.click(saveButton);

    await waitFor(() => expect(createPlayerSanctionMock).toHaveBeenCalled());
    const [, payload] = createPlayerSanctionMock.mock.calls[0];
    expect(payload.sportivePunishmentType).toBe("MinutesLimit");
    expect(payload.targetEventId).toBe(FUTURE_EVENT_ID);
    expect(payload.minutesLimit).toBe(20);
    expect(payload.amountPaid).toBe(10);
    expect(payload.category).toBeTruthy();
  });

  it("muestra el chip 'Cumplida' cuando el backend devuelve status Fulfilled", async () => {
    getTeamSanctionsMock.mockResolvedValue([
      {
        teamPlayerId: "player-1",
        sanctions: [
          {
            id: "s1",
            category: "InternalDiscipline",
            startDate: "2026-01-01",
            sanctionType: "Amonestación",
            description: null,
            estimatedEnd: null,
            endDate: "2026-01-05",
            isAutomatic: false,
            fine: null,
            status: "Fulfilled",
          },
        ],
      },
    ]);

    render(
      <UserProvider>
        <MemoryRouter>
          <Sanctions />
        </MemoryRouter>
      </UserProvider>
    );

    await waitFor(() => expect(getTeamSanctionsMock).toHaveBeenCalled());
    expect(await screen.findByText("Cumplida")).toBeInTheDocument();
  });

  it("deshabilita el botón eliminar para una sanción cumplida sin desconvocatoria futura", async () => {
    getTeamSanctionsMock.mockResolvedValue([
      {
        teamPlayerId: "player-1",
        sanctions: [
          {
            id: "s1",
            category: "InternalDiscipline",
            startDate: "2026-01-01",
            sanctionType: "Amonestación",
            description: null,
            estimatedEnd: null,
            endDate: "2026-01-05",
            isAutomatic: false,
            fine: null,
            status: "Fulfilled",
          },
        ],
      },
    ]);

    render(
      <UserProvider>
        <MemoryRouter>
          <Sanctions />
        </MemoryRouter>
      </UserProvider>
    );

    await waitFor(() => expect(getTeamSanctionsMock).toHaveBeenCalled());
    const deleteButton = await screen.findByRole("button", { name: /eliminar/i });
    expect(deleteButton).toBeDisabled();
  });

  it("habilita el botón eliminar para una desconvocatoria cumplida cuyo evento objetivo aún no ha pasado", async () => {
    getTeamSanctionsMock.mockResolvedValue([
      {
        teamPlayerId: "player-1",
        sanctions: [
          {
            id: "s1",
            category: "Competition",
            startDate: "2026-01-01",
            sanctionType: "Sanción federativa",
            description: null,
            estimatedEnd: null,
            endDate: "2026-01-05",
            isAutomatic: false,
            fine: null,
            sportivePunishmentType: "Deconvocation",
            targetEventId: FUTURE_EVENT_ID,
            status: "Fulfilled",
          },
        ],
      },
    ]);

    render(
      <UserProvider>
        <MemoryRouter>
          <Sanctions />
        </MemoryRouter>
      </UserProvider>
    );

    await waitFor(() => expect(getTeamSanctionsMock).toHaveBeenCalled());
    await waitFor(() => expect(getSportEventsMock).toHaveBeenCalled());
    const deleteButton = await screen.findByRole("button", { name: /eliminar/i });
    await waitFor(() => expect(deleteButton).not.toBeDisabled());
  });
});
