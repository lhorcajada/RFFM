import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { UserProvider } from "../../context/UserContext";
import ScopeMembers from "./ScopeMembers";
import { scopesApi } from "../../services/scopes/scopesApi";
import { clubJoinRequestsApi } from "../../services/clubJoinRequests/clubJoinRequestsApi";

vi.mock("../../services/scopes/scopesApi", () => ({
  scopesApi: {
    getInvitation: vi.fn(),
    listScopeMembers: vi.fn(),
    regenerateInvitation: vi.fn(),
    removeScopeMember: vi.fn(),
  },
}));

vi.mock("../../services/clubJoinRequests/clubJoinRequestsApi", () => ({
  clubJoinRequestsApi: {
    getPendingCount: vi.fn(),
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useSearchParams: () => [new URLSearchParams({ scope: "club", id: "club1" })],
  };
});

describe("ScopeMembers — club join requests badge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(scopesApi.getInvitation).mockResolvedValue({
      scopeKind: "club",
      scopeId: "club1",
      code: "ABC123",
    });
    vi.mocked(scopesApi.listScopeMembers).mockResolvedValue([]);
  });

  it("shows the pending count badge when > 0", async () => {
    vi.mocked(clubJoinRequestsApi.getPendingCount).mockResolvedValue(3);

    render(
      <UserProvider>
        <MemoryRouter initialEntries={["/?scope=club&id=club1"]}>
          <Routes>
            <Route path="/" element={<ScopeMembers />} />
          </Routes>
        </MemoryRouter>
      </UserProvider>
    );

    await waitFor(() => {
      const badge = screen.getByText("3");
      expect(badge).toBeInTheDocument();
    });
  });

  it("hides the badge when count is 0", async () => {
    vi.mocked(clubJoinRequestsApi.getPendingCount).mockResolvedValue(0);

    render(
      <UserProvider>
        <MemoryRouter initialEntries={["/?scope=club&id=club1"]}>
          <Routes>
            <Route path="/" element={<ScopeMembers />} />
          </Routes>
        </MemoryRouter>
      </UserProvider>
    );

    await waitFor(() => {
      expect(scopesApi.listScopeMembers).toHaveBeenCalled();
    });

    const badge = screen.getByText("Solicitudes de entrenadores").closest(".MuiBadge-root");
    expect(badge?.querySelector(".MuiBadge-invisible")).toBeTruthy();
  });

  it("button navigates to /club-join-requests?clubId=...", async () => {
    vi.mocked(clubJoinRequestsApi.getPendingCount).mockResolvedValue(1);

    render(
      <UserProvider>
        <MemoryRouter initialEntries={["/?scope=club&id=club1"]}>
          <Routes>
            <Route path="/" element={<ScopeMembers />} />
            <Route path="/club-join-requests" element={<div>Club Join Requests</div>} />
          </Routes>
        </MemoryRouter>
      </UserProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Solicitudes de entrenadores")).toBeInTheDocument();
    });

    const button = screen.getByRole("link", { name: /solicitudes de entrenadores/i });
    expect(button).toHaveAttribute("href", "/club-join-requests?clubId=club1");
  });
});
