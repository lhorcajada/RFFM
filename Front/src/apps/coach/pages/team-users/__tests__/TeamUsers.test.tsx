import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { UserProvider } from "../../../../../shared/context/UserContext";
import TeamUsers from "../TeamUsers";
import type { GetTeamUsersResponse } from "../../../services/teamUsersService";

const mockGetTeamUsers = vi.fn();
const mockDeleteTeamUserAccount = vi.fn();
const mockSetTeamUserApproval = vi.fn();
const mockNavigate = vi.fn();

vi.mock("../../../services/teamUsersService", () => ({
  default: {
    getTeamUsers: (...args: unknown[]) => mockGetTeamUsers(...args),
    deleteTeamUserAccount: (...args: unknown[]) =>
      mockDeleteTeamUserAccount(...args),
    setTeamUserApproval: (...args: unknown[]) =>
      mockSetTeamUserApproval(...args),
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom"
  );
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const createFixture = (): GetTeamUsersResponse => ({
  teamId: "team-1",
  teamName: "Cadete D",
  callerIsCreator: false,
  users: [
    {
      membershipId: "mem-1",
      userId: "user-1",
      alias: "Yo (el entrenador)",
      email: "coach@example.com",
      membershipKind: "Coach",
      joinedAt: "2026-01-15T10:00:00Z",
      isCreator: true,
      isSelf: true,
      isApproved: true,
      linkedPlayerFullName: null,
    },
    {
      membershipId: "mem-2",
      userId: "user-2",
      alias: "Ayudante Coach",
      email: "assistant@example.com",
      membershipKind: "Coach",
      joinedAt: "2026-02-20T14:30:00Z",
      isCreator: false,
      isSelf: false,
      isApproved: false,
      linkedPlayerFullName: null,
    },
    {
      membershipId: "mem-3",
      userId: "user-3",
      alias: "Papá del Jugador",
      email: "father@example.com",
      membershipKind: "FamilyPlayer",
      joinedAt: "2026-03-01T08:00:00Z",
      isCreator: false,
      isSelf: false,
      isApproved: true,
      linkedPlayerFullName: "Hijo DePrueba",
    },
  ],
});

function getCard(alias: string): HTMLElement {
  return screen.getByText(alias).closest("li")!;
}

function renderTeamUsers(initialEntry: string = "/coach/team-users?teamId=team-1") {
  return render(
    <UserProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <TeamUsers />
      </MemoryRouter>
    </UserProvider>
  );
}

describe("TeamUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a loading state, then a card per user", async () => {
    const fixture = createFixture();
    mockGetTeamUsers.mockResolvedValue(fixture);

    renderTeamUsers();

    expect(screen.getByRole("progressbar")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("list", { name: /usuarios del equipo/i })).toBeInTheDocument();
    });

    expect(screen.getByText("Yo (el entrenador)")).toBeInTheDocument();
    expect(screen.getByText("Ayudante Coach")).toBeInTheDocument();
    expect(screen.getByText("Papá del Jugador")).toBeInTheDocument();
  });

  it("shows the linked team name and a button to go back to the team dashboard", async () => {
    const fixture = createFixture();
    mockGetTeamUsers.mockResolvedValue(fixture);

    renderTeamUsers();

    await waitFor(() => {
      expect(screen.getByText("Cadete D")).toBeInTheDocument();
    });

    const backButton = screen.getByRole("button", { name: /volver/i });
    await userEvent.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith("/coach/team-dashboard?teamId=team-1");
  });

  it("shows translated role labels and approval status per user", async () => {
    const fixture = createFixture();
    mockGetTeamUsers.mockResolvedValue(fixture);

    renderTeamUsers();

    await waitFor(() => {
      expect(screen.getByRole("list", { name: /usuarios del equipo/i })).toBeInTheDocument();
    });

    const assistantCard = getCard("Ayudante Coach");
    expect(within(assistantCard).getByText("Entrenador")).toBeInTheDocument();
    expect(within(assistantCard).getByText(/pendiente de aprobación/i)).toBeInTheDocument();

    const familyCard = getCard("Papá del Jugador");
    expect(within(familyCard).getByText("Familiar de jugador")).toBeInTheDocument();
    expect(within(familyCard).getByText(/aprobado/i)).toBeInTheDocument();
    expect(within(familyCard).getByText(/Hijo DePrueba/)).toBeInTheDocument();
  });

  it("shows a placeholder instead of a date when joinedAt is null (club-level member)", async () => {
    const fixture = createFixture();
    fixture.users[1].joinedAt = null;
    mockGetTeamUsers.mockResolvedValue(fixture);

    renderTeamUsers();

    await waitFor(() => {
      expect(screen.getByRole("list", { name: /usuarios del equipo/i })).toBeInTheDocument();
    });

    const assistantCard = getCard("Ayudante Coach");
    expect(within(assistantCard).getByText(/Alta: —/)).toBeInTheDocument();
  });

  it("shows only the 'Desaprobar' action for an approved user, never 'Aprobar'", async () => {
    const fixture = createFixture();
    mockGetTeamUsers.mockResolvedValue(fixture);

    renderTeamUsers();

    await waitFor(() => {
      expect(screen.getByRole("list", { name: /usuarios del equipo/i })).toBeInTheDocument();
    });

    const familyCard = getCard("Papá del Jugador"); // isApproved: true
    expect(within(familyCard).getByRole("button", { name: /desaprobar/i })).toBeInTheDocument();
    expect(within(familyCard).queryByRole("button", { name: /^aprobar$/i })).not.toBeInTheDocument();
  });

  it("shows only the 'Aprobar' action for a pending user, never 'Desaprobar'", async () => {
    const fixture = createFixture();
    mockGetTeamUsers.mockResolvedValue(fixture);

    renderTeamUsers();

    await waitFor(() => {
      expect(screen.getByRole("list", { name: /usuarios del equipo/i })).toBeInTheDocument();
    });

    const assistantCard = getCard("Ayudante Coach"); // isApproved: false
    expect(within(assistantCard).getByRole("button", { name: /^aprobar$/i })).toBeInTheDocument();
    expect(within(assistantCard).queryByRole("button", { name: /desaprobar/i })).not.toBeInTheDocument();
  });

  it("never shows an approval action on the caller's own card (isSelf)", async () => {
    const fixture = createFixture();
    mockGetTeamUsers.mockResolvedValue(fixture);

    renderTeamUsers();

    await waitFor(() => {
      expect(screen.getByRole("list", { name: /usuarios del equipo/i })).toBeInTheDocument();
    });

    const selfCard = getCard("Yo (el entrenador)");
    expect(within(selfCard).queryByRole("button", { name: /^aprobar$/i })).not.toBeInTheDocument();
    expect(within(selfCard).queryByRole("button", { name: /desaprobar/i })).not.toBeInTheDocument();
  });

  it("clicking 'Aprobar' calls setTeamUserApproval(true), flips the card to Aprobado, and shows a success snackbar", async () => {
    const fixture = createFixture();
    mockGetTeamUsers.mockResolvedValue(fixture);
    mockSetTeamUserApproval.mockResolvedValue(undefined);

    renderTeamUsers();

    await waitFor(() => {
      expect(screen.getByRole("list", { name: /usuarios del equipo/i })).toBeInTheDocument();
    });

    const assistantCard = getCard("Ayudante Coach");
    const approveButton = within(assistantCard).getByRole("button", { name: /^aprobar$/i });
    await userEvent.click(approveButton);

    await waitFor(() => {
      expect(mockSetTeamUserApproval).toHaveBeenCalledWith("mem-2", true);
    });

    await waitFor(() => {
      expect(within(getCard("Ayudante Coach")).getByRole("button", { name: /desaprobar/i })).toBeInTheDocument();
    });
    expect(within(getCard("Ayudante Coach")).getByText(/^Aprobado$/)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("clicking 'Desaprobar' calls setTeamUserApproval(false) and flips the card to Pendiente de aprobación", async () => {
    const fixture = createFixture();
    mockGetTeamUsers.mockResolvedValue(fixture);
    mockSetTeamUserApproval.mockResolvedValue(undefined);

    renderTeamUsers();

    await waitFor(() => {
      expect(screen.getByRole("list", { name: /usuarios del equipo/i })).toBeInTheDocument();
    });

    const familyCard = getCard("Papá del Jugador");
    const revokeButton = within(familyCard).getByRole("button", { name: /desaprobar/i });
    await userEvent.click(revokeButton);

    await waitFor(() => {
      expect(mockSetTeamUserApproval).toHaveBeenCalledWith("mem-3", false);
    });

    await waitFor(() => {
      expect(within(getCard("Papá del Jugador")).getByRole("button", { name: /^aprobar$/i })).toBeInTheDocument();
    });
    expect(within(getCard("Papá del Jugador")).getByText(/pendiente de aprobación/i)).toBeInTheDocument();
  });

  it("a failed setTeamUserApproval call shows an error snackbar and leaves the approval state unchanged", async () => {
    const fixture = createFixture();
    mockGetTeamUsers.mockResolvedValue(fixture);
    const errorResponse = {
      response: { status: 403, data: { detail: "Solo el creador puede aprobar a otro entrenador." } },
    };
    mockSetTeamUserApproval.mockRejectedValue(errorResponse);

    renderTeamUsers();

    await waitFor(() => {
      expect(screen.getByRole("list", { name: /usuarios del equipo/i })).toBeInTheDocument();
    });

    const assistantCard = getCard("Ayudante Coach");
    const approveButton = within(assistantCard).getByRole("button", { name: /^aprobar$/i });
    await userEvent.click(approveButton);

    await waitFor(() => {
      expect(screen.getByText(/Solo el creador puede aprobar a otro entrenador/i)).toBeInTheDocument();
    });

    expect(within(getCard("Ayudante Coach")).getByRole("button", { name: /^aprobar$/i })).toBeInTheDocument();
  });

  it("a card where isSelf === true never renders a delete button", async () => {
    const fixture = createFixture();
    mockGetTeamUsers.mockResolvedValue(fixture);

    renderTeamUsers();

    await waitFor(() => {
      expect(screen.getByRole("list", { name: /usuarios del equipo/i })).toBeInTheDocument();
    });

    const selfCard = getCard("Yo (el entrenador)");
    const deleteButton = within(selfCard).queryByRole("button", {
      name: /eliminar a/i,
    });
    expect(deleteButton).not.toBeInTheDocument();
  });

  it("a card where isCreator === true never renders a delete button", async () => {
    const fixture = createFixture();
    fixture.users[0].isSelf = false;
    fixture.users[0].isCreator = true;
    mockGetTeamUsers.mockResolvedValue(fixture);

    renderTeamUsers();

    await waitFor(() => {
      expect(screen.getByRole("list", { name: /usuarios del equipo/i })).toBeInTheDocument();
    });

    const creatorCard = getCard("Yo (el entrenador)");
    const deleteButton = within(creatorCard).queryByRole("button", {
      name: /eliminar a/i,
    });
    expect(deleteButton).not.toBeInTheDocument();
  });

  it("a card with membershipKind: Coach (not self/creator) renders delete button only when callerIsCreator === true", async () => {
    const fixture = createFixture();
    fixture.callerIsCreator = true;
    fixture.users[1].isSelf = false;
    fixture.users[1].isCreator = false;
    mockGetTeamUsers.mockResolvedValue(fixture);

    renderTeamUsers();

    await waitFor(() => {
      expect(screen.getByRole("list", { name: /usuarios del equipo/i })).toBeInTheDocument();
    });

    const coachCard = getCard("Ayudante Coach");
    const deleteButton = within(coachCard).queryByRole("button", {
      name: /eliminar a/i,
    });
    expect(deleteButton).toBeInTheDocument();
  });

  it("a card with membershipKind: Coach (not self/creator) renders no delete button when callerIsCreator === false", async () => {
    const fixture = createFixture();
    fixture.callerIsCreator = false;
    fixture.users[1].isSelf = false;
    fixture.users[1].isCreator = false;
    mockGetTeamUsers.mockResolvedValue(fixture);

    renderTeamUsers();

    await waitFor(() => {
      expect(screen.getByRole("list", { name: /usuarios del equipo/i })).toBeInTheDocument();
    });

    const coachCard = getCard("Ayudante Coach");
    const deleteButton = within(coachCard).queryByRole("button", {
      name: /eliminar a/i,
    });
    expect(deleteButton).not.toBeInTheDocument();
  });

  it("a card with membershipKind: FamilyPlayer (not self/creator) always renders delete button regardless of callerIsCreator", async () => {
    const fixture = createFixture();
    fixture.callerIsCreator = false;
    fixture.users[2].isSelf = false;
    fixture.users[2].isCreator = false;
    mockGetTeamUsers.mockResolvedValue(fixture);

    renderTeamUsers();

    await waitFor(() => {
      expect(screen.getByRole("list", { name: /usuarios del equipo/i })).toBeInTheDocument();
    });

    const familyCard = getCard("Papá del Jugador");
    const deleteButton = within(familyCard).queryByRole("button", {
      name: /eliminar a papá del jugador/i,
    });
    expect(deleteButton).toBeInTheDocument();
  });

  it("clicking a card's delete button opens a confirmation dialog without calling deleteTeamUserAccount", async () => {
    const fixture = createFixture();
    fixture.callerIsCreator = true;
    fixture.users[1].isSelf = false;
    fixture.users[1].isCreator = false;
    mockGetTeamUsers.mockResolvedValue(fixture);

    renderTeamUsers();

    await waitFor(() => {
      expect(screen.getByRole("list", { name: /usuarios del equipo/i })).toBeInTheDocument();
    });

    const coachCard = getCard("Ayudante Coach");
    const deleteButton = within(coachCard).getByRole("button", {
      name: /eliminar a ayudante coach/i,
    });
    await userEvent.click(deleteButton);

    expect(
      screen.getByRole("heading", { name: /eliminar cuenta/i })
    ).toBeInTheDocument();
    const dialogContent = screen.getByRole("heading", { name: /eliminar cuenta/i }).closest("div")?.parentElement;
    expect(within(dialogContent!).getByText(/Ayudante Coach/)).toBeInTheDocument();

    expect(mockDeleteTeamUserAccount).not.toHaveBeenCalled();
  });

  it("confirming the dialog calls deleteTeamUserAccount, removes the card from the rendered list on success, and shows a success snackbar", async () => {
    const fixture = createFixture();
    fixture.callerIsCreator = true;
    fixture.users[1].isSelf = false;
    fixture.users[1].isCreator = false;
    mockGetTeamUsers.mockResolvedValue(fixture);
    mockDeleteTeamUserAccount.mockResolvedValue(undefined);

    renderTeamUsers();

    await waitFor(() => {
      expect(screen.getByRole("list", { name: /usuarios del equipo/i })).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole("button", {
      name: /eliminar a ayudante coach/i,
    });
    await userEvent.click(deleteButton);

    const confirmButton = screen.getByRole("button", {
      name: /eliminar/i,
    });
    await userEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockDeleteTeamUserAccount).toHaveBeenCalledWith("mem-2");
    });

    expect(screen.queryByText("Ayudante Coach")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("a failed deleteTeamUserAccount call shows an error snackbar with the detail message and leaves the card in the list", async () => {
    const fixture = createFixture();
    fixture.callerIsCreator = false;
    fixture.users[1].isSelf = false;
    fixture.users[1].isCreator = false;
    fixture.users[1].membershipKind = "FamilyPlayer";
    mockGetTeamUsers.mockResolvedValue(fixture);
    const errorResponse = {
      response: {
        status: 403,
        data: { detail: "Custom error message para este test." },
      },
    };
    mockDeleteTeamUserAccount.mockRejectedValue(errorResponse);

    renderTeamUsers();

    await waitFor(() => {
      expect(screen.getByRole("list", { name: /usuarios del equipo/i })).toBeInTheDocument();
    });

    const coachCard = getCard("Ayudante Coach");
    const deleteButton = within(coachCard).getByRole("button", {
      name: /eliminar a ayudante coach/i,
    });
    await userEvent.click(deleteButton);

    const confirmButton = screen.getByRole("button", {
      name: /eliminar/i,
    });
    await userEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText(/Custom error message para este test/i)).toBeInTheDocument();
    });

    const cancelButton = screen.getAllByRole("button", { name: /cancelar/i })[0];
    await userEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.getByText("Ayudante Coach")).toBeInTheDocument();
    });
  });

  it("empty users: [] renders an empty-state message, not an empty list", async () => {
    const fixture = createFixture();
    fixture.users = [];
    mockGetTeamUsers.mockResolvedValue(fixture);

    renderTeamUsers();

    await waitFor(() => {
      expect(
        screen.getByText(/No hay usuarios en este equipo/i)
      ).toBeInTheDocument();
    });
  });

  it("a missing teamId from the query string renders an explanatory message instead of calling getTeamUsers", async () => {
    renderTeamUsers("/coach/team-users");

    expect(mockGetTeamUsers).not.toHaveBeenCalled();

    expect(screen.getByText(/Falta el identificador del equipo/i)).toBeInTheDocument();
  });
});
