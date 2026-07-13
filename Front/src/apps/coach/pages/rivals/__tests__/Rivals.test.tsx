import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../../services/rivalService", () => ({
  getRivals: vi.fn(() => Promise.resolve([])),
  createRival: vi.fn(),
  updateRival: vi.fn(),
  uploadRivalPhoto: vi.fn(),
}));

vi.mock("../../../../federation/services/Federation/ClubService", () => ({
  clubService: {
    getAll: vi.fn(() => Promise.resolve([])),
  },
}));

import Rivals from "../Rivals";

describe("Rivals - Volver button", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("navigates to the concrete team's dashboard (not the general coach dashboard) using the current teamId", async () => {
    render(
      <MemoryRouter initialEntries={["/coach/rivals?teamId=team-999"]}>
        <Routes>
          <Route path="/coach/rivals" element={<Rivals />} />
          <Route path="/coach/team-dashboard" element={<div>Team dashboard for team-999</div>} />
          <Route path="/coach/dashboard" element={<div>General coach dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );

    const backButton = await screen.findByRole("button", { name: /volver/i });
    backButton.click();

    await waitFor(() =>
      expect(screen.getByText("Team dashboard for team-999")).toBeInTheDocument()
    );
    expect(screen.queryByText("General coach dashboard")).not.toBeInTheDocument();
  });
});
