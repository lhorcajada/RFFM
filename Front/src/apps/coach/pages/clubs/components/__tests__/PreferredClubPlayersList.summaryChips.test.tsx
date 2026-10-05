import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../services/clubService", () => ({
  getClubById: vi.fn().mockResolvedValue({ id: "club-1", name: "Real Madrid" }),
}));

vi.mock("../../../../services/configurationCoachService", () => ({
  default: { getCurrent: vi.fn().mockResolvedValue({ preferredClubId: null }) },
}));

vi.mock("../../../../services/playerService", () => ({
  getPlayersByClub: vi.fn().mockResolvedValue([]),
}));

vi.mock("../ClubPlayerCard", () => ({
  default: () => <div data-testid="club-player-card" />,
}));

import PreferredClubPlayersList from "../PreferredClubPlayersList";

describe("PreferredClubPlayersList — resumen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no muestra el identificador interno del club", async () => {
    render(<PreferredClubPlayersList clubId="club-1" />);

    await screen.findByText("Real Madrid");
    expect(screen.queryByText(/Club: club-1/)).not.toBeInTheDocument();
  });
});
