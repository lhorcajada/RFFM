import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockUsePermissions = vi.fn();
const getRolesMock = vi.fn();

vi.mock("../../../../shared/hooks/usePermissions", () => ({
  usePermissions: () => mockUsePermissions(),
}));

vi.mock("../../services/authService", () => ({
  coachAuthService: {
    getRoles: () => getRolesMock(),
  },
}));

import { RequireFeaturePermission } from "../RequireFeaturePermission";

function renderGuard(allowPlayerAccess = true) {
  return render(
    <MemoryRouter initialEntries={["/coach/settings"]}>
      <Routes>
        <Route
          path="/coach/settings"
          element={
            <RequireFeaturePermission
              featureRoute="/coach/settings"
              allowPlayerAccess={allowPlayerAccess}
            >
              <div>Settings content</div>
            </RequireFeaturePermission>
          }
        />
        <Route path="/coach/dashboard" element={<div>Dashboard content</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RequireFeaturePermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRolesMock.mockReturnValue(["Coach"]);
  });

  it("shows a loading indicator while permissions are being fetched", () => {
    mockUsePermissions.mockReturnValue({
      loading: true,
      hasFeatureAccess: () => false,
    });

    renderGuard();

    expect(screen.queryByText("Settings content")).not.toBeInTheDocument();
    expect(screen.queryByText("Dashboard content")).not.toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("renders children when the route is allowed", () => {
    mockUsePermissions.mockReturnValue({
      loading: false,
      hasFeatureAccess: (route: string) => route === "/coach/settings",
    });

    renderGuard();

    expect(screen.getByText("Settings content")).toBeInTheDocument();
  });

  it("redirects away and does not render children when the route is not allowed", () => {
    mockUsePermissions.mockReturnValue({
      loading: false,
      hasFeatureAccess: () => false,
    });

    renderGuard();

    expect(screen.queryByText("Settings content")).not.toBeInTheDocument();
    expect(screen.getByText("Dashboard content")).toBeInTheDocument();
  });

  it.each(["Player", "FamilyPlayer"])(
    "redirects a %s account when player access is disabled",
    (role) => {
      getRolesMock.mockReturnValue([role]);
      mockUsePermissions.mockReturnValue({
        loading: false,
        hasFeatureAccess: () => true,
      });

      renderGuard(false);

      expect(screen.queryByText("Settings content")).not.toBeInTheDocument();
      expect(screen.getByText("Dashboard content")).toBeInTheDocument();
    },
  );

  it("renders children for a coach when player access is disabled", () => {
    mockUsePermissions.mockReturnValue({
      loading: false,
      hasFeatureAccess: () => true,
    });

    renderGuard(false);

    expect(screen.getByText("Settings content")).toBeInTheDocument();
  });
});
