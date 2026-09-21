import { render, screen, waitFor } from "@testing-library/react";
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

const getTeamsForClassification = vi.fn().mockResolvedValue([]);
vi.mock("../../../services/api", () => ({
  getTeamsForClassification: (...args: unknown[]) =>
    getTeamsForClassification(...args),
  getCalendar: vi.fn().mockResolvedValue({}),
  getSettingsForUser: vi.fn().mockImplementation(async () => [
    {
      isPrimary: true,
      competitionId: "c1",
      groupId: "g1",
      seasonId: primarySeasonId,
    },
  ]),
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

import Classification from "../Classification";

describe("Classification — filtro de temporada RFFM", () => {
  beforeEach(() => {
    mockSeasonId = 21;
    mockChangeToken = 0;
    primarySeasonId = undefined;
    vi.clearAllMocks();
  });

  it("muestra el selector de temporada", async () => {
    render(<Classification />);
    expect(await screen.findByLabelText("Temporada RFFM")).toBeInTheDocument();
  });

  it("consulta la clasificación con la temporada seleccionada", async () => {
    mockSeasonId = 22;
    render(<Classification />);
    await waitFor(() =>
      expect(getTeamsForClassification).toHaveBeenCalledWith(
        expect.objectContaining({ season: "22" }),
      ),
    );
  });

  it("aplica por defecto la temporada con la que se configuró el equipo principal", async () => {
    primarySeasonId = 20;
    render(<Classification />);
    await waitFor(() => expect(applySeasonId).toHaveBeenCalledWith(20));
  });

  it("delega en el contexto el respaldo cuando la configuración es antigua y no tiene temporada", async () => {
    render(<Classification />);
    await waitFor(() => expect(applySeasonId).toHaveBeenCalledWith(undefined));
  });

  it("limpia competición y grupo cuando el usuario cambia de temporada", async () => {
    const { rerender } = render(<Classification />);
    await waitFor(() =>
      expect(screen.getByTestId("competition")).toHaveTextContent("c1"),
    );
    mockSeasonId = 22;
    mockChangeToken = 1;
    rerender(<Classification />);
    await waitFor(() => {
      expect(screen.getByTestId("competition")).toBeEmptyDOMElement();
      expect(screen.getByTestId("group")).toBeEmptyDOMElement();
    });
  });
});
