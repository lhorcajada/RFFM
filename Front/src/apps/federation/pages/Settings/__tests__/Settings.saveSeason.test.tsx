import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

const saveSettings = vi.fn().mockResolvedValue({});

vi.mock("../../../../../shared/context/RffmSeasonContext", () => ({
  useRffmSeason: () => ({
    seasonId: 22,
    seasons: [{ id: 22, label: "2026-2027" }],
    seasonChangeToken: 0,
    setSeasonId: vi.fn(),
    applySeasonId: vi.fn(),
  }),
}));
vi.mock("../../../../../shared/context/UserContext", () => ({
  useUser: () => ({ user: { id: "u1" } }),
}));
vi.mock("../../../services/federationApi", () => ({
  settingsService: {
    saveSettings: (...a: unknown[]) => saveSettings(...a),
    deleteSettings: vi.fn(),
    setPrimarySettings: vi.fn(),
  },
  getSettingsForUser: vi.fn().mockResolvedValue([]),
}));
vi.mock("../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../../../../../shared/components/ui/ContentLayout/ContentLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../../../../../shared/components/ui/CompetitionSelector/CompetitionSelector", () => ({
  default: () => null,
}));
vi.mock("../../../../../shared/components/ui/GroupSelector/GroupSelector", () => ({
  default: () => null,
}));
vi.mock("../../../../../shared/components/ui/SavedConfigs/SavedConfigs", () => ({
  default: () => null,
}));
vi.mock("../ClubSearchSection", () => ({ default: () => null }));
vi.mock("../../../../../shared/components/ui/TeamsSelector/TeamsSelector", () => ({
  default: ({ onChange }: { onChange: (t: { id: string; name: string }) => void }) => (
    <button onClick={() => onChange({ id: "t1", name: "Equipo Uno" })}>
      elegir-equipo
    </button>
  ),
}));

import Settings from "../Settings";

describe("Settings — guarda la temporada del equipo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("envía la temporada RFFM seleccionada al guardar la combinación", async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByText("elegir-equipo"));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() =>
      expect(saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({ teamId: "t1", seasonId: 22 }),
      ),
    );
  });
});
