import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { UserProvider } from "../../../../context/UserContext";

let pendingSanctionsMock: { visible: boolean; count: number; teamId: string | null } = {
  visible: false,
  count: 0,
  teamId: null,
};
vi.mock("../../../../hooks/useMyPendingSanctionsCount", () => ({
  default: () => pendingSanctionsMock,
}));

let teamFundMock: { visible: boolean; balance: number | null; teamId: string | null } = {
  visible: false,
  balance: null,
  teamId: null,
};
vi.mock("../../../../hooks/useTeamFundBalance", () => ({
  default: () => teamFundMock,
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

describe("AppHeader — team fund balance icon", () => {
  beforeEach(() => {
    navigateMock.mockClear();
    pendingSanctionsMock = { visible: false, count: 0, teamId: null };
    teamFundMock = { visible: false, balance: null, teamId: null };
  });

  it("renders the fund icon for a Coach-role user even when the sanctions badge is hidden", () => {
    pendingSanctionsMock = { visible: false, count: 0, teamId: null };
    teamFundMock = { visible: true, balance: 250, teamId: "team-1" };

    renderHeader();

    expect(screen.queryByRole("button", { name: /sanciones/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /250 €/i })).toBeInTheDocument();
  });

  it("hides the fund icon when useTeamFundBalance resolves no team", () => {
    teamFundMock = { visible: false, balance: null, teamId: null };

    renderHeader();

    expect(screen.queryByRole("button", { name: /€/i })).not.toBeInTheDocument();
  });

  it("navigates to the sanctions screen, scoped to the team, when the fund icon is clicked", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    teamFundMock = { visible: true, balance: 80, teamId: "team-7" };

    renderHeader();
    await userEvent.click(screen.getByRole("button", { name: /80 €/i }));

    expect(navigateMock).toHaveBeenCalledWith("/coach/sanctions?teamId=team-7");
  });
});
