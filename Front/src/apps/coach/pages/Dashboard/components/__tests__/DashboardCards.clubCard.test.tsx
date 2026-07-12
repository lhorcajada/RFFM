import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockUseFeaturePermission = vi.fn();
vi.mock("../../../../../../shared/hooks/useFeaturePermission", () => ({
  useFeaturePermission: (route: string) => mockUseFeaturePermission(route),
}));

vi.mock("../../../services/configurationCoachService", () => ({ default: {} }));
vi.mock("../../hooks/useUserTeams", () => ({ useUserTeams: () => ({ teams: [], loading: false }) }));
vi.mock("../../../../../shared/services/imageService", () => ({ fetchImage: vi.fn() }));
vi.mock("../../../services/teamService", () => ({ default: {} }));
vi.mock("../../../services/clubService", () => ({ default: {} }));

import DashboardCards from "../DashboardCards";

describe("DashboardCards — tarjeta Club", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no renderiza la tarjeta Club mientras loading=true", () => {
    mockUseFeaturePermission.mockReturnValue({ hasAccess: false, loading: true });
    render(<MemoryRouter><DashboardCards selectedSeason="" /></MemoryRouter>);
    expect(screen.queryByText("Club")).not.toBeInTheDocument();
  });

  it("renderiza la tarjeta Club si hasAccess=true", async () => {
    mockUseFeaturePermission.mockReturnValue({ hasAccess: true, loading: false });
    render(<MemoryRouter><DashboardCards selectedSeason="" /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText("Club")).toBeInTheDocument());
  });

  it("no renderiza la tarjeta Club si hasAccess=false", () => {
    mockUseFeaturePermission.mockReturnValue({ hasAccess: false, loading: false });
    render(<MemoryRouter><DashboardCards selectedSeason="" /></MemoryRouter>);
    expect(screen.queryByText("Club")).not.toBeInTheDocument();
  });
});
