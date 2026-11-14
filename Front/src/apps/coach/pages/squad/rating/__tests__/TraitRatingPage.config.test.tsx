import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
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
vi.mock("../../../../services/traitRatingService", () => ({
  getTeamLatestTraitRatings: vi.fn(),
  createTeamTraitRatings: vi.fn(),
}));
vi.mock("../../../../services/ratingConfigService", () => ({ getRatingConfig: vi.fn() }));

vi.mock("../../../../../../shared/hooks/usePermissions", () => ({
  usePermissions: () => ({ roles: ["Coach"] }),
}));

import TraitRatingPage from "../TraitRatingPage";
import { getPlayersByTeam } from "../../../../services/teamplayerService";
import { createTeamTraitRatings, getTeamLatestTraitRatings } from "../../../../services/traitRatingService";
import { getRatingConfig } from "../../../../services/ratingConfigService";

const players = [
  { id: "juan", name: "Juan", lastName: "Pérez", alias: "", position: "Medio Centro", dorsal: 8, activePositionId: 6 },
  { id: "pedro", name: "Pedro", lastName: "Ruiz", alias: "", position: "Defensa Central", dorsal: 4, activePositionId: 4 },
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/coach/squad/rating-sheet?teamId=team-1&seasonId=season-1&view=traits"]}>
      <Routes>
        <Route path="/coach/squad/rating-sheet" element={<TraitRatingPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("TraitRatingPage · rasgos del equipo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPlayersByTeam).mockResolvedValue(players);
    vi.mocked(getTeamLatestTraitRatings).mockResolvedValue([]);
    vi.mocked(createTeamTraitRatings).mockResolvedValue([]);
    vi.mocked(getRatingConfig).mockResolvedValue({
      capacities: [],
      traits: [
        { key: "custom-a", isCustom: true, isHidden: false, label: "Juego aéreo", phase: "withBall", anchor1: "Nunca", anchor3: "A veces", anchor5: "Siempre" },
        { key: "traitDuels", isCustom: false, isHidden: true, label: null, phase: null, anchor1: null, anchor3: null, anchor5: null },
        { key: "traitPressing", isCustom: false, isHidden: false, label: "Presiona alto", phase: null, anchor1: null, anchor3: null, anchor5: null },
      ],
    });
  });

  it("el tablero lista los rasgos del equipo: el propio, el renombrado y sin el oculto", async () => {
    renderPage();

    expect(await screen.findByRole("button", { name: /^Juego aéreo\d+\/\d+$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Presiona alto\d+\/\d+$/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Gana duelos/ })).not.toBeInTheDocument();
  });

  it("muestra el descriptor del rasgo propio en el nivel 5", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /^Juego aéreo\d+\/\d+$/ }));

    expect(screen.getByRole("group", { name: "Nivel 5" })).toHaveTextContent("Siempre");
  });

  it("la tarjeta por jugador pide los rasgos del equipo y cuenta sobre ellos", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Por jugador" }));

    expect(await screen.findByRole("button", { name: /Juan Pérez.*0\/12/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Juan Pérez/ }));
    expect(screen.getByRole("group", { name: "Juego aéreo" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Gana duelos" })).not.toBeInTheDocument();
  });

  it("guarda el nivel de un rasgo propio", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /^Juego aéreo\d+\/\d+$/ }));

    await user.click(screen.getByRole("button", { name: /Pedro Ruiz/ }));
    await user.click(within(screen.getByRole("group", { name: "Nivel 4" })).getAllByRole("button")[0]);
    await user.click(screen.getByRole("button", { name: "Guardar (1)" }));

    await waitFor(() =>
      expect(createTeamTraitRatings).toHaveBeenCalledWith(
        "team-1",
        expect.objectContaining({
          ratings: [expect.objectContaining({ teamPlayerId: "pedro", levels: [{ traitKey: "custom-a", level: 4 }] })],
        }),
      ),
    );
  });
});
