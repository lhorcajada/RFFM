import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { UserProvider } from "../../context/UserContext";
import TeamPlayerLinkRequests from "./TeamPlayerLinkRequests";
import { teamPlayerLinkRequestsApi } from "../../services/teamPlayerLinkRequests/teamPlayerLinkRequestsApi";
import type { TeamPlayerLinkRequestDto } from "../../types/scope";

vi.mock("../../services/teamPlayerLinkRequests/teamPlayerLinkRequestsApi", () => ({
  teamPlayerLinkRequestsApi: {
    list: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useSearchParams: () => [new URLSearchParams({ teamId: "team1" })],
  };
});

describe("TeamPlayerLinkRequests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows empty message when no pending requests", async () => {
    vi.mocked(teamPlayerLinkRequestsApi.list).mockResolvedValue([]);

    render(
      <UserProvider>
        <MemoryRouter initialEntries={["/team-player-link-requests?teamId=team1"]}>
          <Routes>
            <Route path="/team-player-link-requests" element={<TeamPlayerLinkRequests />} />
          </Routes>
        </MemoryRouter>
      </UserProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("No hay solicitudes pendientes.")).toBeInTheDocument();
    });
  });

  it("renders table with player name column", async () => {
    const mockRequests: TeamPlayerLinkRequestDto[] = [
      {
        id: "req1",
        applicationUserId: "user1",
        applicantAlias: "Juan",
        applicantEmail: "juan@test.com",
        teamPlayerId: "player1",
        playerName: "Carlos López",
        membershipKey: "Player",
        status: "Pending",
        requestedAt: "2026-01-01T10:00:00Z",
        decidedAt: null,
        decidedByAlias: null,
      },
    ];
    vi.mocked(teamPlayerLinkRequestsApi.list).mockResolvedValue(mockRequests);

    render(
      <UserProvider>
        <MemoryRouter initialEntries={["/team-player-link-requests?teamId=team1"]}>
          <Routes>
            <Route path="/team-player-link-requests" element={<TeamPlayerLinkRequests />} />
          </Routes>
        </MemoryRouter>
      </UserProvider>
    );

    await waitFor(() => {
      const table = screen.getByRole("table", { name: /solicitudes de vinculación a jugadores/i });
      expect(within(table).getByText("Juan")).toBeInTheDocument();
      expect(within(table).getByText("juan@test.com")).toBeInTheDocument();
      expect(within(table).getByText("Carlos López")).toBeInTheDocument();
    });
  });

  it("approve action opens confirm dialog and calls api", async () => {
    const mockRequests: TeamPlayerLinkRequestDto[] = [
      {
        id: "req1",
        applicationUserId: "user1",
        applicantAlias: "Juan",
        applicantEmail: "juan@test.com",
        teamPlayerId: "player1",
        playerName: "Carlos López",
        membershipKey: "Player",
        status: "Pending",
        requestedAt: "2026-01-01T10:00:00Z",
        decidedAt: null,
        decidedByAlias: null,
      },
    ];
    vi.mocked(teamPlayerLinkRequestsApi.list).mockResolvedValue(mockRequests);
    vi.mocked(teamPlayerLinkRequestsApi.approve).mockResolvedValue();

    const user = userEvent.setup();
    render(
      <UserProvider>
        <MemoryRouter initialEntries={["/team-player-link-requests?teamId=team1"]}>
          <Routes>
            <Route path="/team-player-link-requests" element={<TeamPlayerLinkRequests />} />
          </Routes>
        </MemoryRouter>
      </UserProvider>
    );

    await waitFor(() => {
      const table = screen.getByRole("table");
      expect(within(table).getByText("Juan")).toBeInTheDocument();
    });

    const approveButtons = screen.getAllByLabelText(/Aceptar a/);
    await user.click(approveButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/¿Vincular a Juan/)).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole("button", { name: "Confirmar" });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(teamPlayerLinkRequestsApi.approve).toHaveBeenCalledWith("req1");
    });
  });

  it("reject action opens confirm dialog and calls api", async () => {
    const mockRequests: TeamPlayerLinkRequestDto[] = [
      {
        id: "req1",
        applicationUserId: "user1",
        applicantAlias: "Juan",
        applicantEmail: "juan@test.com",
        teamPlayerId: "player1",
        playerName: "Carlos López",
        membershipKey: "Player",
        status: "Pending",
        requestedAt: "2026-01-01T10:00:00Z",
        decidedAt: null,
        decidedByAlias: null,
      },
    ];
    vi.mocked(teamPlayerLinkRequestsApi.list).mockResolvedValue(mockRequests);
    vi.mocked(teamPlayerLinkRequestsApi.reject).mockResolvedValue();

    const user = userEvent.setup();
    render(
      <UserProvider>
        <MemoryRouter initialEntries={["/team-player-link-requests?teamId=team1"]}>
          <Routes>
            <Route path="/team-player-link-requests" element={<TeamPlayerLinkRequests />} />
          </Routes>
        </MemoryRouter>
      </UserProvider>
    );

    await waitFor(() => {
      const table = screen.getByRole("table");
      expect(within(table).getByText("Juan")).toBeInTheDocument();
    });

    const rejectButtons = screen.getAllByLabelText(/Rechazar a/);
    await user.click(rejectButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/¿Rechazar la solicitud de Juan/)).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole("button", { name: "Confirmar" });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(teamPlayerLinkRequestsApi.reject).toHaveBeenCalledWith("req1");
    });
  });

  it("tab change loads decided requests", async () => {
    const pendingRequests: TeamPlayerLinkRequestDto[] = [
      {
        id: "req1",
        applicationUserId: "user1",
        applicantAlias: "Juan",
        applicantEmail: "juan@test.com",
        teamPlayerId: "player1",
        playerName: "Carlos López",
        membershipKey: "Player",
        status: "Pending",
        requestedAt: "2026-01-01T10:00:00Z",
        decidedAt: null,
        decidedByAlias: null,
      },
    ];

    const decidedRequests: TeamPlayerLinkRequestDto[] = [
      {
        id: "req2",
        applicationUserId: "user2",
        applicantAlias: "María",
        applicantEmail: "maria@test.com",
        teamPlayerId: "player2",
        playerName: "Ana García",
        membershipKey: "FamilyPlayer",
        status: "Approved",
        requestedAt: "2025-12-01T10:00:00Z",
        decidedAt: "2025-12-02T14:00:00Z",
        decidedByAlias: "Coach",
      },
    ];

    vi.mocked(teamPlayerLinkRequestsApi.list).mockImplementation(
      (teamId, status) => {
        if (status === "pending") return Promise.resolve(pendingRequests);
        return Promise.resolve(decidedRequests);
      }
    );

    const user = userEvent.setup();
    render(
      <UserProvider>
        <MemoryRouter initialEntries={["/team-player-link-requests?teamId=team1"]}>
          <Routes>
            <Route path="/team-player-link-requests" element={<TeamPlayerLinkRequests />} />
          </Routes>
        </MemoryRouter>
      </UserProvider>
    );

    await waitFor(() => {
      const table = screen.getByRole("table");
      expect(within(table).getByText("Juan")).toBeInTheDocument();
    });

    const decidedTab = screen.getByRole("tab", { name: "Decididas" });
    await user.click(decidedTab);

    await waitFor(() => {
      const table = screen.getByRole("table");
      expect(within(table).getByText("María")).toBeInTheDocument();
      expect(within(table).getByText("Ana García")).toBeInTheDocument();
    });
  });
});
