import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UserProvider } from "../../../../shared/context/UserContext";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../services/clubService", () => ({
  getUserClubs: vi.fn(),
}));

import { getUserClubs } from "../../services/clubService";
import CoachDashboard from "../Dashboard";

describe("CoachDashboard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("shows only Clubs card when user has no clubs", async () => {
    (getUserClubs as any).mockResolvedValue([]);

    render(
      <MemoryRouter>
        <UserProvider>
          <CoachDashboard />
        </UserProvider>
      </MemoryRouter>
    );

    await waitFor(() => expect(getUserClubs).toHaveBeenCalled());

    // Clubs should be visible
    expect(screen.getByText(/Clubs/i)).toBeInTheDocument();
    // Another card should not be visible
    await waitFor(() => {
      expect(screen.queryByText(/Plantilla/i)).not.toBeInTheDocument();
    });
  });

  it("shows other cards when user has clubs", async () => {
    (getUserClubs as any).mockResolvedValue([
      {
        clubId: "1",
        clubName: "C1",
        shieldUrl: "",
        role: "admin",
        roleId: 1,
        isCreator: true,
      },
    ]);

    render(
      <MemoryRouter>
        <UserProvider>
          <CoachDashboard />
        </UserProvider>
      </MemoryRouter>
    );

    await waitFor(() => expect(getUserClubs).toHaveBeenCalled());

    expect(screen.getByText(/Clubs/i)).toBeInTheDocument();
    // Other cards should appear
    expect(screen.getByText(/Plantilla/i)).toBeInTheDocument();
    expect(screen.getByText(/Partidos/i)).toBeInTheDocument();
  });
});
