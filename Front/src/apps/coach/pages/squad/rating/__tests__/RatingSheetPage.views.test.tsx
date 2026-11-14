import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../../../../../shared/components/ui/ContentLayout/ContentLayout", () => ({
  default: ({ actionBar, children }: { actionBar?: React.ReactNode; children?: React.ReactNode }) => (
    <div>
      <div>{actionBar}</div>
      <div>{children}</div>
    </div>
  ),
}));

vi.mock("../../../../services/teamplayerService", () => ({ getPlayersByTeam: vi.fn() }));
vi.mock("../../../../services/playerRatingService", () => ({
  getTeamLatestRatings: vi.fn(),
  createTeamRatings: vi.fn(),
}));
vi.mock("../TraitRatingPage", () => ({ default: () => <div>Vista de conducta</div> }));
vi.mock("../PositionFitPage", () => ({ default: () => <div>Vista de orden por puesto</div> }));

const mockUsePermissions = vi.fn();
vi.mock("../../../../../../shared/hooks/usePermissions", () => ({
  usePermissions: () => mockUsePermissions(),
}));

import RatingSheetPage from "../RatingSheetPage";
import { getPlayersByTeam } from "../../../../services/teamplayerService";
import { getTeamLatestRatings } from "../../../../services/playerRatingService";

const players = [
  { id: "juan", name: "Juan", lastName: "Pérez", alias: "", position: "Delantero", dorsal: 9 },
];

function renderAt(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/coach/squad/rating-sheet${search}`]}>
      <Routes>
        <Route path="/coach/squad/rating-sheet" element={<RatingSheetPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RatingSheetPage · vistas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePermissions.mockReturnValue({ roles: ["Coach"] });
    vi.mocked(getPlayersByTeam).mockResolvedValue(players);
    vi.mocked(getTeamLatestRatings).mockResolvedValue([]);
  });

  it("muestra la hoja de capacidad por defecto", async () => {
    renderAt("?teamId=team-1&seasonId=season-1");

    expect(await screen.findByRole("group", { name: "Sin colocar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Capacidad" })).toHaveAttribute("aria-pressed", "true");
  });

  it("muestra la valoración por rasgos con view=traits", async () => {
    renderAt("?teamId=team-1&seasonId=season-1&view=traits");

    expect(await screen.findByText("Vista de conducta")).toBeInTheDocument();
  });

  it("muestra el orden por puesto con view=order", async () => {
    renderAt("?teamId=team-1&seasonId=season-1&view=order");

    expect(await screen.findByText("Vista de orden por puesto")).toBeInTheDocument();
  });

  it("cambia a la valoración por rasgos desde la hoja de capacidad", async () => {
    const user = userEvent.setup();
    renderAt("?teamId=team-1&seasonId=season-1");
    await screen.findByRole("group", { name: "Sin colocar" });

    await user.click(screen.getByRole("button", { name: "Conducta en partido" }));

    expect(await screen.findByText("Vista de conducta")).toBeInTheDocument();
  });

  it("pide confirmación al cambiar de vista con cambios sin guardar en la hoja de capacidad", async () => {
    const user = userEvent.setup();
    renderAt("?teamId=team-1&seasonId=season-1");
    await screen.findByRole("group", { name: "Sin colocar" });
    await user.click(screen.getByRole("button", { name: /Juan Pérez/ }));
    await user.click(within(screen.getByRole("group", { name: "Nivel 5" })).getAllByRole("button")[0]);

    await user.click(screen.getByRole("button", { name: "Conducta en partido" }));

    expect(await screen.findByText("Cambiar de vista")).toBeInTheDocument();
    expect(screen.queryByText("Vista de conducta")).not.toBeInTheDocument();
  });
});
