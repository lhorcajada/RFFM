import { render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

const applySeasonId = vi.fn();
let settings: unknown[] = [];

vi.mock("../../../../../shared/context/RffmSeasonContext", () => ({
  useRffmSeason: () => ({
    seasonId: 22,
    seasons: [{ id: 22, label: "2026-2027" }],
    seasonChangeToken: 0,
    setSeasonId: vi.fn(),
    applySeasonId: (id: number) => applySeasonId(id),
  }),
}));
const stableUser = { user: { id: "u1" } };
vi.mock("../../../../../shared/context/UserContext", () => ({
  useUser: () => stableUser,
}));
vi.mock("../../../services/federationApi", () => ({
  settingsService: {
    saveSettings: vi.fn(),
    deleteSettings: vi.fn(),
    setPrimarySettings: vi.fn(),
  },
  getSettingsForUser: vi.fn().mockImplementation(async () => settings),
}));
vi.mock("../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../../../../../shared/components/ui/ContentLayout/ContentLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../../../../../shared/components/ui/CompetitionSelector/CompetitionSelector", () => ({
  default: ({ value }: { value?: string }) => (
    <div data-testid="competition">{value ?? ""}</div>
  ),
}));
vi.mock("../../../../../shared/components/ui/GroupSelector/GroupSelector", () => ({
  default: ({ value }: { value?: string }) => (
    <div data-testid="group">{value ?? ""}</div>
  ),
}));
vi.mock("../../../../../shared/components/ui/TeamsSelector/TeamsSelector", () => ({
  default: ({ value }: { value?: string }) => (
    <div data-testid="team">{value ?? ""}</div>
  ),
}));
vi.mock("../../../../../shared/components/ui/SavedConfigs/SavedConfigs", () => ({
  default: () => null,
}));
vi.mock("../ClubSearchSection", () => ({ default: () => null }));

import Settings from "../Settings";

const combo = (id: string, isPrimary: boolean, seasonId: number) => ({
  id,
  isPrimary,
  competitionId: `c-${id}`,
  competitionName: `Liga ${id}`,
  groupId: `g-${id}`,
  groupName: `Grupo ${id}`,
  teamId: `t-${id}`,
  teamName: `Equipo ${id}`,
  seasonId,
  createdAt: 1,
});

describe("Settings — al cambiar el equipo principal con la estrella", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settings = [combo("A", true, 22), combo("B", false, 21)];
  });

  it("recarga competición, grupo y equipo con los del nuevo principal y aplica su temporada", async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("team")).toHaveTextContent("t-A"),
    );

    settings = [combo("A", false, 22), combo("B", true, 21)];
    await act(async () => {
      window.dispatchEvent(new Event("rffm.saved_combinations_changed"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("competition")).toHaveTextContent("c-B");
      expect(screen.getByTestId("group")).toHaveTextContent("g-B");
      expect(screen.getByTestId("team")).toHaveTextContent("t-B");
    });
    expect(applySeasonId).toHaveBeenLastCalledWith(21);
  });
});
