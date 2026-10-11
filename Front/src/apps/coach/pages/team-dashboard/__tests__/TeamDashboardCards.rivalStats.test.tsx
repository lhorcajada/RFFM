import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockHasFeatureAccess = vi.fn();
vi.mock("../../../../../shared/hooks/usePermissions", () => ({
  usePermissions: () => ({ loading: false, hasFeatureAccess: mockHasFeatureAccess }),
}));

import TeamDashboardCards from "../TeamDashboardCards";
import type { TeamResponse } from "../../../services/teamService";

const team = { id: "team-1", name: "Infantil A" } as TeamResponse;

function renderCards() {
  return render(
    <MemoryRouter>
      <TeamDashboardCards team={team} selectedSeason="" />
    </MemoryRouter>,
  );
}

describe("TeamDashboardCards - estadísticas de rivales", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enlaza a las estadísticas de rivales del equipo", () => {
    mockHasFeatureAccess.mockReturnValue(true);

    renderCards();

    expect(screen.getByRole("link", { name: "Estadísticas de rivales" })).toHaveAttribute(
      "href",
      "/coach/rival-stats?teamId=team-1",
    );
  });

  it("no muestra la tarjeta sin permiso sobre la competición del equipo", () => {
    mockHasFeatureAccess.mockImplementation((route: string) => route !== "/coach/convocations");

    renderCards();

    expect(screen.queryByRole("link", { name: "Estadísticas de rivales" })).not.toBeInTheDocument();
  });
});
