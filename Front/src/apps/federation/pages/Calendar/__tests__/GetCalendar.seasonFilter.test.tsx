import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

let mockSeasonId = 21;
let mockChangeToken = 0;
let primarySeasonId: number | undefined;
const applySeasonId = vi.fn();

vi.mock("../../../../../shared/context/RffmSeasonContext", () => ({
  useRffmSeason: () => ({
    seasonId: mockSeasonId,
    seasons: [
      { id: 21, label: "2025-2026" },
      { id: 22, label: "2026-2027" },
    ],
    seasonChangeToken: mockChangeToken,
    setSeasonId: vi.fn(),
    applySeasonId: (id: number) => applySeasonId(id),
  }),
}));

vi.mock("../../../../../shared/context/UserContext", () => ({
  useUser: () => ({ user: { id: "u1" } }),
}));

vi.mock("../../../services/federationApi", () => ({
  getSettingsForUser: vi
    .fn()
    .mockImplementation(async () => [
      {
        isPrimary: true,
        competitionId: "c1",
        groupId: "g1",
        seasonId: primarySeasonId,
      },
    ]),
}));

const useCalendar = vi.fn();
vi.mock("../../../../../shared/hooks/useCalendar", () => ({
  default: (args: unknown) => {
    useCalendar(args);
    return {
      calendar: null,
      loading: false,
      selectedTab: 0,
      setSelectedTab: vi.fn(),
      rounds: [],
      matchesByRound: {},
    };
  },
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

import GetCalendar from "../GetCalendar";

const renderPage = () =>
  render(
    <MemoryRouter>
      <GetCalendar />
    </MemoryRouter>,
  );

describe("GetCalendar — filtros de temporada, competición y grupo", () => {
  beforeEach(() => {
    mockSeasonId = 21;
    mockChangeToken = 0;
    primarySeasonId = undefined;
    vi.clearAllMocks();
  });

  it("muestra el selector de temporada, competición y grupo", async () => {
    renderPage();
    expect(await screen.findByLabelText("Temporada RFFM")).toBeInTheDocument();
    expect(screen.getByTestId("competition")).toBeInTheDocument();
    expect(screen.getByTestId("group")).toBeInTheDocument();
  });

  it("carga el calendario con la temporada seleccionada", async () => {
    mockSeasonId = 22;
    renderPage();
    await waitFor(() =>
      expect(useCalendar).toHaveBeenCalledWith(
        expect.objectContaining({ season: "22" }),
      ),
    );
  });

  it("aplica por defecto la temporada con la que se configuró el equipo principal", async () => {
    primarySeasonId = 20;
    renderPage();
    await waitFor(() => expect(applySeasonId).toHaveBeenCalledWith(20));
  });

  it("limpia competición y grupo cuando el usuario cambia de temporada", async () => {
    const { rerender } = renderPage();
    await waitFor(() =>
      expect(screen.getByTestId("group")).toHaveTextContent("g1"),
    );
    mockSeasonId = 22;
    mockChangeToken = 1;
    rerender(
      <MemoryRouter>
        <GetCalendar />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("competition")).toBeEmptyDOMElement();
      expect(screen.getByTestId("group")).toBeEmptyDOMElement();
    });
  });
});
