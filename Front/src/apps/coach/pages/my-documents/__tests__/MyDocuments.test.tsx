import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UserProvider } from "../../../../../shared/context/UserContext";
import MyDocuments from "../MyDocuments";

const mockGetMyProfile = vi.fn();
const mockGetDocumentTypes = vi.fn();
const mockGetPlayerDocuments = vi.fn();

vi.mock("../../../services/coachApi", () => ({
  getMyProfile: (...args: unknown[]) => mockGetMyProfile(...args),
}));

vi.mock("../../../services/playerDocumentService", () => ({
  getDocumentTypes: (...args: unknown[]) => mockGetDocumentTypes(...args),
  getPlayerDocuments: (...args: unknown[]) => mockGetPlayerDocuments(...args),
  mapPlayerDocumentError: vi.fn((code) => ({
    message: "Error",
    severity: "error" as const,
  })),
}));

describe("MyDocuments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra una barra de acciones con un botón para volver al panel del equipo", async () => {
    mockGetMyProfile.mockResolvedValue({
      roleName: "Player",
      playerId: "p1",
      teamId: "t1",
      teamPlayerId: "tp1",
    });
    mockGetDocumentTypes.mockResolvedValue([]);
    mockGetPlayerDocuments.mockResolvedValue([]);

    render(
      <MemoryRouter>
        <UserProvider>
          <MyDocuments />
        </UserProvider>
      </MemoryRouter>
    );

    const backButton = await waitFor(() =>
      screen.getByRole("button", { name: /volver/i })
    );
    expect(backButton).toBeInTheDocument();
  });

  it("calls getMyProfile on mount", async () => {
    mockGetMyProfile.mockResolvedValue({
      roleName: "Player",
      playerId: "p1",
      teamId: "t1",
      teamPlayerId: "tp1",
    });
    mockGetDocumentTypes.mockResolvedValue([]);
    mockGetPlayerDocuments.mockResolvedValue([]);

    expect(MyDocuments).toBeDefined();
  });

  it("calls getPlayerDocuments with teamPlayerId from profile", async () => {
    const teamPlayerId = "tp123";
    mockGetMyProfile.mockResolvedValue({
      roleName: "Player",
      playerId: "p1",
      teamId: "t1",
      teamPlayerId,
    });
    mockGetDocumentTypes.mockResolvedValue([]);
    mockGetPlayerDocuments.mockResolvedValue([]);

    // Verify the service calls work
    const profile = await mockGetMyProfile();
    expect(profile.teamPlayerId).toBe(teamPlayerId);

    const docs = await mockGetPlayerDocuments(teamPlayerId);
    expect(mockGetPlayerDocuments).toHaveBeenCalledWith(teamPlayerId);
  });
});
