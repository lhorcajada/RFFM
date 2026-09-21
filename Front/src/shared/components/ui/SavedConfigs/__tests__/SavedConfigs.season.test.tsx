import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("../../../../context/RffmSeasonContext", () => ({
  useRffmSeason: () => ({
    seasonId: 21,
    currentSeasonId: 22,
    seasons: [
      { id: 21, label: "2025-2026" },
      { id: 22, label: "2026-2027" },
    ],
    seasonChangeToken: 0,
    setSeasonId: vi.fn(),
    applySeasonId: vi.fn(),
  }),
}));

vi.mock("../../../../context/UserContext", () => ({
  useUser: () => ({ user: { id: "u1" } }),
}));

vi.mock("../../../../../apps/federation/services/federationApi", () => ({
  settingsService: { setPrimarySettings: vi.fn(), deleteSettings: vi.fn() },
  getSettingsForUser: vi.fn().mockResolvedValue([
    {
      id: "1",
      teamName: "Equipo Uno",
      competitionName: "Liga",
      groupName: "Grupo 1",
      seasonId: 21,
      createdAt: 1,
      isPrimary: true,
    },
    {
      id: "2",
      teamName: "Equipo Dos",
      competitionName: "Liga",
      groupName: "Grupo 2",
      createdAt: 2,
    },
  ]),
}));

import SavedConfigs from "../SavedConfigs";

describe("SavedConfigs — temporada guardada", () => {
  it("muestra la temporada con la que se configuró el equipo", async () => {
    render(<SavedConfigs />);
    expect(await screen.findByText("Temporada 2025-2026")).toBeInTheDocument();
  });

  it("una configuración antigua sin temporada se muestra con la temporada actual", async () => {
    render(<SavedConfigs />);
    await screen.findByText("Equipo Dos");
    expect(screen.getByText("Temporada 2026-2027")).toBeInTheDocument();
  });
});
