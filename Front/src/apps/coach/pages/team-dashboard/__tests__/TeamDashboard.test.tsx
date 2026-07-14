import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

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

vi.mock("../../../hooks/useTeamAndClub.tsx", () => ({
  default: vi.fn(() => ({
    teamTitleNode: <span>Equipo 1</span>,
    clubSubtitleNode: <span>Club 1</span>,
    team: null,
  })),
}));

const mockUsePlayerAutoLoad = vi.fn();
vi.mock("../../Dashboard/hooks/usePlayerAutoLoad", () => ({
  usePlayerAutoLoad: () => mockUsePlayerAutoLoad(),
}));

vi.mock("../TeamDashboardCards", () => ({
  default: () => <div>TeamDashboardCards</div>,
}));

import TeamDashboard from "../TeamDashboard";

describe("TeamDashboard back button", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows 'Volver' and navigates to /appSelector when the user is a player", async () => {
    mockUsePlayerAutoLoad.mockReturnValue({ isPlayer: true });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <TeamDashboard />
      </MemoryRouter>
    );

    const button = screen.getByRole("button", { name: "Volver" });
    expect(button).toBeInTheDocument();

    await user.click(button);

    expect(mockNavigate).toHaveBeenCalledWith("/appSelector");
  });

  it("shows 'Volver al dashboard de entrenador' and navigates to /coach/dashboard when the user is a coach", async () => {
    mockUsePlayerAutoLoad.mockReturnValue({ isPlayer: false });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <TeamDashboard />
      </MemoryRouter>
    );

    const button = screen.getByRole("button", { name: "Volver al dashboard de entrenador" });
    expect(button).toBeInTheDocument();

    await user.click(button);

    expect(mockNavigate).toHaveBeenCalledWith("/coach/dashboard");
  });
});
