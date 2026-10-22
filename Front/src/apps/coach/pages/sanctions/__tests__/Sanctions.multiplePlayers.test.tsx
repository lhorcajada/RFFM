import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
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
vi.mock("../../../services/teamplayerSanctionService", () => ({
  default: {
    getPlayerSanctions: vi.fn(),
    createPlayerSanction: (...args: unknown[]) => createPlayerSanctionMock(...args),
    updatePlayerSanction: vi.fn(),
    deletePlayerSanction: vi.fn(),
    getTeamSanctions: (...args: unknown[]) => getTeamSanctionsMock(...args),
  },
  getTeamSanctions: (...args: unknown[]) => getTeamSanctionsMock(...args),
  createPlayerSanction: (...args: unknown[]) => createPlayerSanctionMock(...args),
  updatePlayerSanction: vi.fn(),
  deletePlayerSanction: vi.fn(),
}));

vi.mock("../../../services/sportEventService", () => ({
  default: { getSportEvents: vi.fn().mockResolvedValue({ items: [] }) },
  getSportEvents: vi.fn().mockResolvedValue({ items: [] }),
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

function buildPlayers() {
  return [
    { id: "player-1", name: "Juan", lastName: "Pérez", alias: "Juanito", dorsal: 7 },
    { id: "player-2", name: "Luis", lastName: "García", alias: "Luisito", dorsal: 9 },
    { id: "player-3", name: "Pedro", lastName: "Sanz", alias: "Pedrito", dorsal: 4 },
  ];
}

function renderPage() {
  render(
    <UserProvider>
      <MemoryRouter>
        <Sanctions />
      </MemoryRouter>
    </UserProvider>
  );
}

async function openAddDialog() {
  await waitFor(() => expect(getTeamSanctionsMock).toHaveBeenCalled());
  await userEvent.click(await screen.findByRole("button", { name: /añadir sanción/i }));
  return screen.findByRole("dialog");
}

async function selectPlayer(dialog: HTMLElement, search: string, optionText: string) {
  const playerField = within(dialog).getByRole("combobox", { name: /jugadores/i });
  await userEvent.click(playerField);
  await userEvent.type(playerField, search);
  await userEvent.click(await screen.findByRole("option", { name: optionText }));
}

describe("Sanctions — misma sanción para varios jugadores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPlayersByTeamMock.mockResolvedValue(buildPlayers());
    getTeamSanctionsMock.mockResolvedValue([]);
  });

  it("crea la misma sanción para cada jugador seleccionado", async () => {
    createPlayerSanctionMock.mockResolvedValue({ id: "new" });
    renderPage();
    const dialog = await openAddDialog();

    await selectPlayer(dialog, "Juan", "Juan Pérez");
    await selectPlayer(dialog, "Luis", "Luis García");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Tipo de sanción" }), "Retraso");
    await userEvent.type(within(dialog).getByLabelText(/multa/i), "5");
    await userEvent.click(within(dialog).getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(createPlayerSanctionMock).toHaveBeenCalledTimes(2));
    const calledIds = createPlayerSanctionMock.mock.calls.map(([id]) => id);
    expect(calledIds).toEqual(["player-1", "player-2"]);
    const [[, firstPayload], [, secondPayload]] = createPlayerSanctionMock.mock.calls;
    expect(firstPayload).toEqual(secondPayload);
    expect(firstPayload).toMatchObject({ sanctionType: "Retraso", fine: 5 });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("si falla para algún jugador avisa con su nombre y deja el diálogo abierto solo con los fallidos", async () => {
    createPlayerSanctionMock.mockImplementation((id: string) =>
      Promise.resolve(id === "player-2" ? null : { id: `new-${id}` })
    );
    const snackbarListener = vi.fn();
    window.addEventListener("rffm.show_snackbar", snackbarListener);

    renderPage();
    const dialog = await openAddDialog();

    await selectPlayer(dialog, "Juan", "Juan Pérez");
    await selectPlayer(dialog, "Luis", "Luis García");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Tipo de sanción" }), "Retraso");
    await userEvent.click(within(dialog).getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(snackbarListener).toHaveBeenCalled());
    const detail = (snackbarListener.mock.calls[0][0] as CustomEvent).detail;
    expect(detail.severity).toBe("error");
    expect(detail.message).toContain("Luis García");

    const openDialog = screen.getByRole("dialog");
    expect(within(openDialog).getByRole("button", { name: "Luis García" })).toBeInTheDocument();
    expect(within(openDialog).queryByRole("button", { name: "Juan Pérez" })).not.toBeInTheDocument();

    window.removeEventListener("rffm.show_snackbar", snackbarListener);
  });
});
