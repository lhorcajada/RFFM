import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("../../../../services/teamplayerService", () => ({
  getPlayersByTeam: vi.fn(),
}));

vi.mock("../../../../services/playerRatingService", () => ({
  getTeamLatestRatings: vi.fn(),
  createTeamRatings: vi.fn(),
}));

const mockUsePermissions = vi.fn();
vi.mock("../../../../../../shared/hooks/usePermissions", () => ({
  usePermissions: () => mockUsePermissions(),
}));

import RatingSheetPage from "../RatingSheetPage";
import { FIELD_PLAYER_CHARACTERISTICS } from "../ratingConcepts";
import { getPlayersByTeam } from "../../../../services/teamplayerService";
import { createTeamRatings, getTeamLatestRatings } from "../../../../services/playerRatingService";
import type { PlayerRating } from "../../../../types/playerRating";

function rating(teamPlayerId: string, levels: Record<string, number>, notes: string | null = null): PlayerRating {
  return {
    id: `rating-${teamPlayerId}`,
    teamPlayerId,
    isGoalkeeper: false,
    physical: 5,
    technical: 5,
    tactical: 5,
    competitiveness: 5,
    ratedAt: "2026-09-01T00:00:00Z",
    notes,
    answers: Object.entries(levels).map(([characteristicKey, level]) => ({
      characteristicKey,
      level,
      concept: "x",
      categoryKey: "physical",
    })),
  };
}

const allFieldAtFive = Object.fromEntries(FIELD_PLAYER_CHARACTERISTICS.map((c) => [c.key, 5]));

const players = [
  { id: "juan", name: "Juan", lastName: "Pérez", alias: "", position: "Delantero", dorsal: 9 },
  { id: "pedro", name: "Pedro", lastName: "Ruiz", alias: "", position: "Defensa", dorsal: 4 },
  { id: "luis", name: "Luis", lastName: "Gil", alias: "", position: "Centrocampista", dorsal: 8 },
  { id: "iker", name: "Iker", lastName: "Sanz", alias: "", position: "Portero", dorsal: 1 },
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/coach/squad/rating-sheet?teamId=team-1&seasonId=season-1"]}>
      <Routes>
        <Route path="/coach/squad/rating-sheet" element={<RatingSheetPage />} />
        <Route path="/coach/squad" element={<div>Plantilla</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function renderLoadedPage() {
  renderPage();
  await screen.findByRole("group", { name: "Sin colocar" });
}

function level(n: number) {
  return screen.getByRole("group", { name: `Nivel ${n}` });
}

function unplaced() {
  return screen.getByRole("group", { name: "Sin colocar" });
}

async function place(user: ReturnType<typeof userEvent.setup>, playerName: RegExp, target: HTMLElement) {
  await user.click(screen.getByRole("button", { name: playerName }));
  await user.click(within(target).getAllByRole("button")[0]);
}

describe("RatingSheetPage", () => {
  const dispatchSpy = vi.spyOn(window, "dispatchEvent");

  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePermissions.mockReturnValue({ roles: ["Coach"] });
    vi.mocked(getPlayersByTeam).mockResolvedValue(players);
    vi.mocked(getTeamLatestRatings).mockResolvedValue([
      rating("juan", { physicalSpeed: 7 }),
      rating("luis", allFieldAtFive, "Zurdo"),
    ]);
    vi.mocked(createTeamRatings).mockResolvedValue([]);
  });

  afterEach(() => {
    dispatchSpy.mockClear();
  });

  describe("hojas y niveles", () => {
    it("coloca al jugador en el nivel de su última valoración", async () => {
      await renderLoadedPage();

      expect(within(level(7)).getByRole("button", { name: /Juan Pérez/ })).toBeInTheDocument();
    });

    it("deja en «Sin colocar» al jugador sin valoración", async () => {
      await renderLoadedPage();

      expect(within(unplaced()).getByRole("button", { name: /Pedro Ruiz/ })).toBeInTheDocument();
    });

    it("no muestra a los porteros en la hoja de jugadores", async () => {
      await renderLoadedPage();

      expect(screen.queryByRole("button", { name: /Iker Sanz/ })).not.toBeInTheDocument();
    });

    it("muestra a los porteros al cambiar a la hoja de porteros", async () => {
      const user = userEvent.setup();
      await renderLoadedPage();

      await user.click(screen.getByRole("button", { name: "Porteros" }));

      expect(within(unplaced()).getByRole("button", { name: /Iker Sanz/ })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Juan Pérez/ })).not.toBeInTheDocument();
    });

    it("muestra el progreso de cada característica", async () => {
      await renderLoadedPage();

      expect(screen.getByRole("button", { name: /Velocidad.*2\/3/ })).toBeInTheDocument();
    });

    it("muestra los niveles de la característica que se selecciona", async () => {
      const user = userEvent.setup();
      await renderLoadedPage();

      await user.click(screen.getByRole("button", { name: /Resistencia/ }));

      expect(within(unplaced()).getByRole("button", { name: /Juan Pérez/ })).toBeInTheDocument();
      expect(within(level(5)).getByRole("button", { name: /Luis Gil/ })).toBeInTheDocument();
    });
  });

  describe("colocar jugadores", () => {
    it("coloca a un jugador al tocarlo y después tocar un nivel", async () => {
      const user = userEvent.setup();
      await renderLoadedPage();

      await place(user, /Pedro Ruiz/, level(6));

      expect(within(level(6)).getByRole("button", { name: /Pedro Ruiz/ })).toBeInTheDocument();
      expect(within(unplaced()).queryByRole("button", { name: /Pedro Ruiz/ })).not.toBeInTheDocument();
    });

    it("coloca a varios jugadores a la vez", async () => {
      const user = userEvent.setup();
      await renderLoadedPage();

      await user.click(screen.getByRole("button", { name: /Pedro Ruiz/ }));
      await place(user, /Juan Pérez/, level(4));

      expect(within(level(4)).getByRole("button", { name: /Pedro Ruiz/ })).toBeInTheDocument();
      expect(within(level(4)).getByRole("button", { name: /Juan Pérez/ })).toBeInTheDocument();
    });

    it("limpia la selección después de colocar", async () => {
      const user = userEvent.setup();
      await renderLoadedPage();

      await place(user, /Pedro Ruiz/, level(6));

      expect(screen.getByRole("button", { name: /Pedro Ruiz/ })).toHaveAttribute("aria-pressed", "false");
    });

    it("deselecciona al jugador al tocarlo otra vez", async () => {
      const user = userEvent.setup();
      await renderLoadedPage();

      await user.click(screen.getByRole("button", { name: /Pedro Ruiz/ }));
      await place(user, /Pedro Ruiz/, level(6));

      expect(within(unplaced()).getByRole("button", { name: /Pedro Ruiz/ })).toBeInTheDocument();
    });

    it("devuelve al jugador a «Sin colocar»", async () => {
      const user = userEvent.setup();
      await renderLoadedPage();

      await place(user, /Juan Pérez/, unplaced());

      expect(within(unplaced()).getByRole("button", { name: /Juan Pérez/ })).toBeInTheDocument();
    });

    it("no permite colocar ni guardar sin rol de entrenador", async () => {
      mockUsePermissions.mockReturnValue({ roles: ["ClubDirector"] });
      await renderLoadedPage();

      expect(screen.getByRole("button", { name: /Pedro Ruiz/ })).toBeDisabled();
      expect(screen.queryByRole("button", { name: /guardar/i })).not.toBeInTheDocument();
    });
  });

  describe("filtro por línea", () => {
    it("muestra solo a los defensas al filtrar por «Defensas»", async () => {
      const user = userEvent.setup();
      await renderLoadedPage();

      await user.click(screen.getByRole("button", { name: "Defensas" }));

      expect(screen.getByRole("button", { name: /Pedro Ruiz/ })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Juan Pérez/ })).not.toBeInTheDocument();
    });

    it("no ofrece el filtro en la hoja de porteros", async () => {
      const user = userEvent.setup();
      await renderLoadedPage();

      await user.click(screen.getByRole("button", { name: "Porteros" }));

      expect(screen.queryByRole("button", { name: "Defensas" })).not.toBeInTheDocument();
    });
  });

  describe("guardar", () => {
    it("deshabilita «Guardar» cuando no hay cambios", async () => {
      await renderLoadedPage();

      expect(screen.getByRole("button", { name: /guardar/i })).toBeDisabled();
    });

    it("guarda solo al jugador que ha cambiado, con todas sus respuestas y la fecha elegida", async () => {
      const user = userEvent.setup();
      await renderLoadedPage();
      fireEvent.change(screen.getByLabelText("Fecha de valoración"), { target: { value: "2026-10-13" } });

      await place(user, /Luis Gil/, level(8));
      await user.click(screen.getByRole("button", { name: /guardar/i }));

      await waitFor(() => expect(createTeamRatings).toHaveBeenCalledTimes(1));
      const [teamId, payload] = vi.mocked(createTeamRatings).mock.calls[0];
      expect(teamId).toBe("team-1");
      expect(payload.ratedAt).toBe("2026-10-13T00:00:00.000Z");
      expect(payload.ratings).toHaveLength(1);
      expect(payload.ratings[0].teamPlayerId).toBe("luis");
      expect(payload.ratings[0].notes).toBe("Zurdo");
      expect(payload.ratings[0].answers).toHaveLength(FIELD_PLAYER_CHARACTERISTICS.length);
    });

    it("avisa del jugador incompleto y no lo incluye en el guardado", async () => {
      const user = userEvent.setup();
      await renderLoadedPage();

      await place(user, /Pedro Ruiz/, level(6));

      expect(screen.getByRole("alert")).toHaveTextContent("Pedro Ruiz");
      expect(screen.getByRole("button", { name: /guardar/i })).toBeDisabled();
    });

    it("vuelve a deshabilitar «Guardar» tras guardar correctamente", async () => {
      const user = userEvent.setup();
      await renderLoadedPage();
      await place(user, /Luis Gil/, level(8));

      await user.click(screen.getByRole("button", { name: /guardar/i }));

      await waitFor(() => expect(screen.getByRole("button", { name: /guardar/i })).toBeDisabled());
      expect(within(level(8)).getByRole("button", { name: /Luis Gil/ })).toBeInTheDocument();
    });

    it("muestra un error y conserva lo colocado cuando falla el guardado", async () => {
      vi.mocked(createTeamRatings).mockRejectedValue(new Error("boom"));
      const user = userEvent.setup();
      await renderLoadedPage();
      await place(user, /Luis Gil/, level(8));

      await user.click(screen.getByRole("button", { name: /guardar/i }));

      await waitFor(() =>
        expect(dispatchSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "rffm.show_snackbar",
            detail: expect.objectContaining({ severity: "error" }),
          }),
        ),
      );
      expect(within(level(8)).getByRole("button", { name: /Luis Gil/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /guardar/i })).toBeEnabled();
    });
  });

  describe("volver", () => {
    it("vuelve a la plantilla directamente cuando no hay cambios", async () => {
      const user = userEvent.setup();
      await renderLoadedPage();

      await user.click(screen.getByRole("button", { name: "Volver" }));

      expect(screen.getByText("Plantilla")).toBeInTheDocument();
    });

    it("pide confirmación antes de salir con cambios sin guardar", async () => {
      const user = userEvent.setup();
      await renderLoadedPage();
      await place(user, /Luis Gil/, level(8));

      await user.click(screen.getByRole("button", { name: "Volver" }));

      expect(screen.getByRole("dialog")).toHaveTextContent(/cambios sin guardar/i);
      expect(screen.queryByText("Plantilla")).not.toBeInTheDocument();
    });
  });
});
