import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { UserProvider } from "../../../../context/UserContext";

let hookMock: { visible: boolean; count: number; teamId: string | null } = {
  visible: false,
  count: 0,
  teamId: null,
};
vi.mock("../../../../hooks/useMyPendingSanctionsCount", () => ({
  default: () => hookMock,
}));

vi.mock("../../../../hooks/useAuthToken", () => ({
  default: () => ({ isAuthValid: true, token: "fake-token", refresh: vi.fn() }),
}));

vi.mock("../../../../hooks/useRootClassObserver", () => ({
  default: () => {},
}));

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

import AppHeader from "../AppHeader";

function renderHeader() {
  return render(
    <MemoryRouter>
      <UserProvider>
        <AppHeader />
      </UserProvider>
    </MemoryRouter>
  );
}

describe("AppHeader — pending sanctions icon", () => {
  beforeEach(() => {
    navigateMock.mockClear();
    hookMock = { visible: false, count: 0, teamId: null };
  });

  it("does not render the sanctions icon for a Coach/Administrator (visible: false)", () => {
    renderHeader();
    expect(screen.queryByRole("button", { name: /sanciones/i })).not.toBeInTheDocument();
  });

  it("renders the sanctions icon (with no badge number) for a Player/FamilyMember with no pending sanctions", () => {
    hookMock = { visible: true, count: 0, teamId: "team-1" };
    renderHeader();
    const button = screen.getByRole("button", { name: /sanciones/i });
    expect(button).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("shows the pending count as a badge on the sanctions icon, separate from the avatar", () => {
    hookMock = { visible: true, count: 3, teamId: "team-1" };
    renderHeader();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(
      screen.getByLabelText(/3 sanciones pendientes/i)
    ).toBeInTheDocument();
    // The avatar menu button keeps its own unrelated label.
    expect(screen.getByRole("button", { name: /abrir menú de usuario/i })).toBeInTheDocument();
  });

  it("navigates to the sanctions screen, scoped to the user's team, when clicked", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    hookMock = { visible: true, count: 2, teamId: "team-9" };
    renderHeader();

    await userEvent.click(screen.getByRole("button", { name: /sanciones/i }));

    expect(navigateMock).toHaveBeenCalledWith("/coach/sanctions?teamId=team-9");
  });

  it("navigates without a teamId query param when the team is unknown", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    hookMock = { visible: true, count: 2, teamId: null };
    renderHeader();

    await userEvent.click(screen.getByRole("button", { name: /sanciones/i }));

    expect(navigateMock).toHaveBeenCalledWith("/coach/sanctions");
  });
});
