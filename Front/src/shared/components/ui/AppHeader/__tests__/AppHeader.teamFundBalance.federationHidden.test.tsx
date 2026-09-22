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

function renderHeader(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <UserProvider>
        <AppHeader />
      </UserProvider>
    </MemoryRouter>
  );
}

describe("AppHeader — team fund balance icon hidden in federation app", () => {
  beforeEach(() => {
    navigateMock.mockClear();
    pendingSanctionsMock = { visible: false, count: 0, teamId: null };
    teamFundMock = { visible: true, balance: 250, teamId: "team-1" };
  });

  it("does not render the fund icon while browsing the federation app", () => {
    renderHeader("/federation/dashboard");

    expect(screen.queryByRole("button", { name: /250 €/i })).not.toBeInTheDocument();
  });

  it("still renders the fund icon while browsing the coach app", () => {
    renderHeader("/coach/dashboard");

    expect(screen.getByRole("button", { name: /250 €/i })).toBeInTheDocument();
  });
});
