import { render, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUseRffmSeason = vi.fn();

vi.mock("../../../../../shared/context/RffmSeasonContext", () => ({
  useRffmSeason: () => mockUseRffmSeason(),
}));

vi.mock("../../../services/api", () => ({
  getActa: vi.fn().mockResolvedValue(null),
  getSettingsForUser: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../components/players/PlayerQuickViewDialog/PlayerQuickViewDialog", () => ({
  default: (props: { seasonId?: string }) => (
    <div data-testid="player-quick-view" data-season-id={props.seasonId ?? ""} />
  ),
}));

import { getActa } from "../../../services/api";
import { UserProvider } from "../../../../../shared/context/UserContext";
import Acta from "../Acta";

describe("Acta — RFFM season wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRffmSeason.mockReturnValue({
      seasonId: 22,
      seasons: [{ id: 22, label: "2026-2027" }],
      setSeasonId: vi.fn(),
    });
  });

  it("requests the acta using the RFFM season from context instead of a hardcoded value", async () => {
    render(
      <UserProvider>
        <MemoryRouter initialEntries={["/federation/acta/ABC123"]}>
          <Routes>
            <Route path="/federation/acta/:codacta" element={<Acta />} />
          </Routes>
        </MemoryRouter>
      </UserProvider>,
    );

    await waitFor(() =>
      expect(getActa).toHaveBeenCalledWith(
        "ABC123",
        expect.objectContaining({ temporada: "22" }),
      ),
    );
  });

  it("passes the RFFM season as the PlayerQuickViewDialog seasonId", async () => {
    const { findByTestId } = render(
      <UserProvider>
        <MemoryRouter initialEntries={["/federation/acta/ABC123"]}>
          <Routes>
            <Route path="/federation/acta/:codacta" element={<Acta />} />
          </Routes>
        </MemoryRouter>
      </UserProvider>,
    );

    const dialog = await findByTestId("player-quick-view");
    expect(dialog.getAttribute("data-season-id")).toBe("22");
  });
});
