import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

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

const mockTeam = { id: "team-1", name: "Equipo 1" };
vi.mock("../../../hooks/useTeamAndClub", () => ({
  default: vi.fn(() => ({ team: mockTeam })),
}));

const mockGoToTeamDashboard = vi.fn();
vi.mock("../../../hooks/useTeamDashboardBack", () => ({
  default: () => mockGoToTeamDashboard,
}));

const mockGetDocumentTypes = vi.fn();
const mockGetTeamDocumentsStatus = vi.fn();
vi.mock("../../../services/playerDocumentService", () => ({
  getDocumentTypes: (...args: unknown[]) => mockGetDocumentTypes(...args),
  getTeamDocumentsStatus: (...args: unknown[]) => mockGetTeamDocumentsStatus(...args),
  mapPlayerDocumentError: vi.fn(() => ({ message: "Error", severity: "error" as const })),
  downloadTeamDocumentsReport: vi.fn(),
  downloadTeamDocumentsZip: vi.fn(),
}));

vi.mock("../../../services/playerService", () => ({
  fetchPlayerPhoto: vi.fn().mockResolvedValue(null),
}));

const mockUseMediaQuery = vi.fn();
vi.mock("@mui/material/useMediaQuery", () => ({
  default: (...args: unknown[]) => mockUseMediaQuery(...args),
}));

import PlayerDocumentsTracking from "../PlayerDocumentsTracking";

function renderPage() {
  render(
    <MemoryRouter>
      <PlayerDocumentsTracking />
    </MemoryRouter>
  );
}

describe("PlayerDocumentsTracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDocumentTypes.mockResolvedValue([{ id: "dt1", name: "Autorización", description: null, isActive: true }]);
    mockGetTeamDocumentsStatus.mockResolvedValue([]);
  });

  it("shows a 'Volver' button that navigates back to the team dashboard", async () => {
    mockUseMediaQuery.mockReturnValue(false);
    renderPage();

    const backButton = await screen.findByRole("button", { name: /volver/i });
    await userEvent.click(backButton);

    expect(mockGoToTeamDashboard).toHaveBeenCalled();
  });

  it("renders text buttons on desktop", async () => {
    mockUseMediaQuery.mockReturnValue(false);
    renderPage();

    expect(await screen.findByRole("button", { name: "Volver" })).toBeInTheDocument();
  });

  it("renders icon-only buttons on mobile", async () => {
    mockUseMediaQuery.mockReturnValue(true);
    renderPage();

    const backButton = await screen.findByRole("button", { name: /volver/i });
    expect(backButton).not.toHaveTextContent("Volver");
  });
});
