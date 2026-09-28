import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../../apps/coach/services/seasonService", () => ({
  default: { getActiveSeason: vi.fn() },
  COACH_ACTIVE_SEASON_CHANGED_EVENT: "rffm.coach_active_season_changed",
}));
vi.mock("../../../../../apps/federation/services/federationApi", () => ({
  getSettingsForUser: vi.fn().mockResolvedValue([]),
}));
vi.mock("../../../../context/UserContext", () => ({
  useUser: () => ({ user: null }),
}));

import Footer from "../Footer";
import seasonService from "../../../../../apps/coach/services/seasonService";

function renderCoachFooter() {
  render(
    <MemoryRouter initialEntries={["/coach/dashboard"]}>
      <Footer hideMenu />
    </MemoryRouter>
  );
}

describe("Footer — temporada activa en Coach", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (seasonService.getActiveSeason as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "season-1",
      name: "Temporada 2026-2027",
      startDate: "2026-07-01",
      endDate: "2027-06-30",
    });
  });

  it("muestra solo el nombre de la temporada, sin la etiqueta 'Temporada activa' ni las fechas", async () => {
    renderCoachFooter();

    expect(await screen.findByText("Temporada 2026-2027")).toBeInTheDocument();
    expect(screen.queryByText("Temporada activa")).not.toBeInTheDocument();
    expect(screen.queryByText(/01\/07\/2026/)).not.toBeInTheDocument();
    expect(screen.queryByText(/30\/6\/2027|30\/06\/2027/)).not.toBeInTheDocument();
  });
});
