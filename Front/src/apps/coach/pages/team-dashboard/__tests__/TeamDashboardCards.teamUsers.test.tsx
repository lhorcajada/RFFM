import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockUsePermissions = vi.fn();

vi.mock("../../../../../shared/hooks/usePermissions", () => ({
  usePermissions: () => mockUsePermissions(),
}));

import TeamDashboardCards from "../TeamDashboardCards";

const mockTeam = { id: "team-123", name: "Test Team" };

function renderCards(isPlayer: boolean = false, team = mockTeam) {
  return render(
    <MemoryRouter>
      <TeamDashboardCards team={team} selectedSeason="" isPlayer={isPlayer} />
    </MemoryRouter>,
  );
}

describe("TeamDashboardCards — Team Users card", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePermissions.mockReturnValue({
      loading: false,
      hasFeatureAccess: () => true,
    });
  });

  it("when rendered with isPlayer={false}, renders a link named 'Gestión de usuarios' whose href is `/coach/team-users?teamId=${team.id}`", () => {
    renderCards(false, mockTeam);

    const link = screen.getByRole("link", { name: "Gestión de usuarios" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", `/coach/team-users?teamId=${mockTeam.id}`);
  });

  it("when rendered with isPlayer={true}, the 'Gestión de usuarios' link is absent", () => {
    renderCards(true, mockTeam);

    const link = screen.queryByRole("link", { name: "Gestión de usuarios" });
    expect(link).not.toBeInTheDocument();
  });

  it("when rendered with isPlayer={false} and team={null}, the link still renders with href='/coach/team-users'", () => {
    renderCards(false, null);

    const link = screen.getByRole("link", { name: "Gestión de usuarios" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/coach/team-users");
  });
});
