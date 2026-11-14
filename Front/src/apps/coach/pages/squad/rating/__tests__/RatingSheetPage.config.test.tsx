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
vi.mock("../../../../services/ratingConfigService", () => ({ getRatingConfig: vi.fn() }));

const mockUsePermissions = vi.fn();
vi.mock("../../../../../../shared/hooks/usePermissions", () => ({
  usePermissions: () => mockUsePermissions(),
}));

import RatingSheetPage from "../RatingSheetPage";
import { getPlayersByTeam } from "../../../../services/teamplayerService";
import { getTeamLatestRatings } from "../../../../services/playerRatingService";
import { getRatingConfig } from "../../../../services/ratingConfigService";

const texts = Array.from({ length: 10 }, (_, i) => `Texto personalizado ${i + 1}`);

const players = [{ id: "juan", name: "Juan", lastName: "Pérez", alias: "", position: "Delantero", dorsal: 9 }];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/coach/squad/rating-sheet?teamId=team-1&seasonId=season-1"]}>
      <Routes>
        <Route path="/coach/squad/rating-sheet" element={<RatingSheetPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RatingSheetPage · capacidades del equipo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePermissions.mockReturnValue({ roles: ["Coach"] });
    vi.mocked(getPlayersByTeam).mockResolvedValue(players);
    vi.mocked(getTeamLatestRatings).mockResolvedValue([]);
  });

  it("lista una capacidad propia y muestra sus 10 textos de nivel", async () => {
    const user = userEvent.setup();
    vi.mocked(getRatingConfig).mockResolvedValue({
      capacities: [
        { key: "custom-a", isCustom: true, isHidden: false, sheet: "field", categoryKey: "technical", label: "Juego aéreo ofensivo", levelTexts: texts },
      ],
      traits: [],
    });
    renderPage();

    await user.click(await screen.findByRole("button", { name: /Juego aéreo ofensivo/ }));

    expect(screen.getByRole("group", { name: "Nivel 10" })).toHaveTextContent("Texto personalizado 10");
    expect(within(screen.getByRole("group", { name: "Sin colocar" })).getByRole("button", { name: /Juan Pérez/ })).toBeInTheDocument();
  });

  it("no lista una capacidad oculta", async () => {
    vi.mocked(getRatingConfig).mockResolvedValue({
      capacities: [
        { key: "physicalSpeed", isCustom: false, isHidden: true, sheet: "field", categoryKey: "physical", label: null, levelTexts: null },
      ],
      traits: [],
    });
    renderPage();

    await screen.findByRole("group", { name: "Sin colocar" });
    expect(await screen.findByRole("button", { name: /^Resistencia\d+\/\d+$/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Velocidad\d+\/\d+$/ })).not.toBeInTheDocument();
  });

  it("usa la etiqueta personalizada de una capacidad por defecto", async () => {
    vi.mocked(getRatingConfig).mockResolvedValue({
      capacities: [
        { key: "technicalDribbling", isCustom: false, isHidden: false, sheet: "field", categoryKey: "technical", label: "Regate en corto", levelTexts: null },
      ],
      traits: [],
    });
    renderPage();

    expect(await screen.findByRole("button", { name: /Regate en corto/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Regate\d/ })).not.toBeInTheDocument();
  });

  it("si falla la lectura de la configuración muestra las capacidades por defecto", async () => {
    vi.mocked(getRatingConfig).mockRejectedValue(new Error("403"));
    renderPage();

    expect(await screen.findByRole("button", { name: /Velocidad/ })).toBeInTheDocument();
  });
});
