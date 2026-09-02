import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../../shared/context/RffmSeasonContext", () => ({
  useRffmSeason: () => ({
    seasonId: 22,
    seasons: [{ id: 22, label: "2026-2027" }],
    setSeasonId: vi.fn(),
  }),
}));

vi.mock("../../../services/federationApi", () => ({
  settingsService: {
    saveSettings: vi.fn(),
    deleteSettings: vi.fn(),
    setPrimarySettings: vi.fn(),
  },
  getSettingsForUser: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../../../shared/context/UserContext", () => ({
  useUser: () => ({ user: { id: "u1", username: "test" } }),
}));

import Settings from "../Settings";

describe("Settings — RFFM season selector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the RffmSeasonSelector inside the club search block", async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    );

    expect(
      await screen.findByLabelText("Temporada RFFM"),
    ).toBeInTheDocument();
  });
});
