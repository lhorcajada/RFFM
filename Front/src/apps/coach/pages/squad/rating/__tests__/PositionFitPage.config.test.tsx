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

vi.mock("../../../../services/positionFitService", () => ({
  getTeamPositionFit: vi.fn(),
  savePositionFitOrder: vi.fn(),
  savePositionTraitWeights: vi.fn(),
}));
vi.mock("../../../../services/ratingConfigService", () => ({ getRatingConfig: vi.fn() }));

vi.mock("../../../../../../shared/hooks/usePermissions", () => ({
  usePermissions: () => ({ roles: ["Coach"] }),
}));

import PositionFitPage from "../PositionFitPage";
import { getTeamPositionFit, savePositionTraitWeights } from "../../../../services/positionFitService";
import { getRatingConfig } from "../../../../services/ratingConfigService";
import { DEFAULT_TRAIT_WEIGHTS } from "../ratingTraits";
import type { PositionFit } from "../../../../types/positionFit";

// Peso de cada rasgo que devuelve el servidor para el equipo: sin el oculto y con el propio en «suma».
const weights = Object.fromEntries(
  Object.entries(DEFAULT_TRAIT_WEIGHTS.defensiveMidfielder).filter(([key]) => key !== "traitDuels"),
);
weights["custom-a"] = "sum";

const data: PositionFit[] = [
  {
    position: "defensiveMidfielder",
    confirmedWeekStart: null,
    isManual: false,
    candidates: [{ teamPlayerId: "a", name: "Álvaro", place: 1, fit: 4.2, trend: "same" }],
    weights,
  },
];

describe("PositionFitPage · rasgos del equipo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTeamPositionFit).mockResolvedValue(data);
    vi.mocked(savePositionTraitWeights).mockResolvedValue(data[0]);
    vi.mocked(getRatingConfig).mockResolvedValue({
      capacities: [],
      traits: [
        { key: "custom-a", isCustom: true, isHidden: false, label: "Juego aéreo", phase: "withBall", anchor1: "Nunca", anchor3: "A veces", anchor5: "Siempre" },
        { key: "traitDuels", isCustom: false, isHidden: true, label: null, phase: null, anchor1: null, anchor3: null, anchor5: null },
      ],
    });
  });

  function renderPage() {
    return render(
      <MemoryRouter initialEntries={["/coach/squad/rating-sheet?teamId=team-1&view=order"]}>
        <Routes>
          <Route path="/coach/squad/rating-sheet" element={<PositionFitPage />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  async function openWeights(user: ReturnType<typeof userEvent.setup>) {
    await screen.findByRole("list", { name: /Candidatos de Mediocentro defensivo/ });
    await user.click(screen.getByRole("button", { name: /Pesos del puesto/ }));
  }

  it("los pesos ofrecen el rasgo propio con peso «Suma» y no el oculto", async () => {
    const user = userEvent.setup();
    renderPage();

    await openWeights(user);

    const custom = within(screen.getByRole("group", { name: "Peso de Juego aéreo" }));
    expect(custom.getByRole("button", { name: "Suma" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("group", { name: "Peso de Gana duelos" })).not.toBeInTheDocument();
  });

  it("guarda el peso del rasgo propio", async () => {
    const user = userEvent.setup();
    renderPage();
    await openWeights(user);

    await user.click(within(screen.getByRole("group", { name: "Peso de Juego aéreo" })).getByRole("button", { name: "Clave" }));
    await user.click(screen.getByRole("button", { name: "Guardar pesos" }));

    await waitFor(() =>
      expect(savePositionTraitWeights).toHaveBeenCalledWith(
        "team-1",
        "defensiveMidfielder",
        expect.objectContaining({ "custom-a": "key" }),
      ),
    );
  });
});
