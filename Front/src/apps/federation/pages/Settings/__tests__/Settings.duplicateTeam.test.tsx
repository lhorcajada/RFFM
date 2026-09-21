import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

const saveSettings = vi.fn().mockResolvedValue({});
let mockSeasonId = 22;
let savedCombos: unknown[] = [];

vi.mock("../../../../../shared/context/RffmSeasonContext", () => ({
  useRffmSeason: () => ({
    seasonId: mockSeasonId,
    currentSeasonId: 22,
    seasons: [
      { id: 22, label: "2026-2027" },
      { id: 21, label: "2025-2026" },
    ],
    seasonChangeToken: 0,
    setSeasonId: vi.fn(),
    applySeasonId: vi.fn(),
  }),
}));
const stableUser = { user: { id: "u1" } };
vi.mock("../../../../../shared/context/UserContext", () => ({
  useUser: () => stableUser,
}));
vi.mock("../../../services/federationApi", () => ({
  settingsService: {
    saveSettings: (...a: unknown[]) => saveSettings(...a),
    deleteSettings: vi.fn(),
    setPrimarySettings: vi.fn(),
  },
  getSettingsForUser: vi.fn().mockImplementation(async () => savedCombos),
}));
vi.mock("../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../../../../../shared/components/ui/ContentLayout/ContentLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../../../../../shared/components/ui/SavedConfigs/SavedConfigs", () => ({
  default: () => null,
}));
vi.mock("../ClubSearchSection", () => ({ default: () => null }));
vi.mock("../../../../../shared/components/ui/CompetitionSelector/CompetitionSelector", () => ({
  default: ({ onChange }: { onChange: (c: unknown) => void }) => (
    <button onClick={() => onChange({ id: "c1", name: "Liga", categoryGroup: "" })}>
      elegir-competicion
    </button>
  ),
}));
vi.mock("../../../../../shared/components/ui/GroupSelector/GroupSelector", () => ({
  default: ({ onChange }: { onChange: (g: unknown) => void }) => (
    <button onClick={() => onChange({ id: "g1", name: "Grupo 1" })}>
      elegir-grupo
    </button>
  ),
}));
vi.mock("../../../../../shared/components/ui/TeamsSelector/TeamsSelector", () => ({
  default: ({ onChange }: { onChange: (t: unknown) => void }) => (
    <button onClick={() => onChange({ id: "t1", name: "Equipo Uno" })}>
      elegir-equipo
    </button>
  ),
}));

import Settings from "../Settings";

const saved = (over: Record<string, unknown> = {}) => ({
  id: "s1",
  teamId: "t1",
  teamName: "Equipo Uno",
  competitionId: "c1",
  groupId: "g1",
  seasonId: 22,
  isPrimary: true,
  createdAt: 1,
  ...over,
});

async function pickTeam() {
  fireEvent.click(await screen.findByText("elegir-competicion"));
  fireEvent.click(screen.getByText("elegir-grupo"));
  fireEvent.click(screen.getByText("elegir-equipo"));
}

const renderPage = () =>
  render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>,
  );

describe("Settings — un equipo solo está repetido si coinciden temporada, competición, grupo y equipo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSeasonId = 22;
    savedCombos = [];
  });

  it("bloquea guardar cuando ya existe exactamente el mismo equipo", async () => {
    savedCombos = [saved()];
    renderPage();
    await pickTeam();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled(),
    );
  });

  it("permite guardar el mismo equipo en otra temporada", async () => {
    savedCombos = [saved({ seasonId: 21 })];
    renderPage();
    await pickTeam();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled(),
    );
  });

  it("permite guardar el mismo equipo en otro grupo", async () => {
    savedCombos = [saved({ groupId: "g9" })];
    renderPage();
    await pickTeam();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled(),
    );
  });

  it("permite guardar el mismo equipo en otra competición", async () => {
    savedCombos = [saved({ competitionId: "c9" })];
    renderPage();
    await pickTeam();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled(),
    );
  });

  it("una combinación antigua sin temporada cuenta como de la temporada actual", async () => {
    savedCombos = [saved({ seasonId: null })];
    renderPage();
    await pickTeam();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled(),
    );
  });

  it("guarda el equipo cuando solo coincide el id pero no la temporada", async () => {
    savedCombos = [saved({ seasonId: 21 })];
    renderPage();
    await pickTeam();
    const save = screen.getByRole("button", { name: "Guardar" });
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);
    await waitFor(() =>
      expect(saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({ teamId: "t1", groupId: "g1", seasonId: 22 }),
      ),
    );
  });
});
