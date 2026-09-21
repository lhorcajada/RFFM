import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

let mockSeasonId: number | null = 21;

vi.mock("../../../../context/RffmSeasonContext", () => ({
  useRffmSeason: () => ({ seasonId: mockSeasonId, seasons: [], setSeasonId: vi.fn() }),
}));

const getCompetitions = vi.fn();
vi.mock("../../../../../apps/federation/services/api", () => ({
  getCompetitions: (...args: unknown[]) => getCompetitions(...args),
}));

import CompetitionSelector from "../CompetitionSelector";

describe("CompetitionSelector — temporada RFFM", () => {
  beforeEach(() => {
    mockSeasonId = 21;
    vi.clearAllMocks();
    getCompetitions.mockResolvedValue([]);
  });

  it("carga las competiciones de la temporada seleccionada", async () => {
    mockSeasonId = 22;
    render(<CompetitionSelector />);
    await waitFor(() => expect(getCompetitions).toHaveBeenCalledWith(22));
  });

  it("vuelve a cargar las competiciones cuando cambia la temporada", async () => {
    const { rerender } = render(<CompetitionSelector />);
    await waitFor(() => expect(getCompetitions).toHaveBeenCalledWith(21));
    mockSeasonId = 20;
    rerender(<CompetitionSelector />);
    await waitFor(() => expect(getCompetitions).toHaveBeenCalledWith(20));
  });
});

describe("CompetitionSelector — valor controlado", () => {
  beforeEach(() => {
    mockSeasonId = 21;
    vi.clearAllMocks();
    getCompetitions.mockResolvedValue([
      { id: "c1", name: "Liga Alevín", categoryGroup: "Alevín" },
    ]);
  });

  it("vacía la selección mostrada cuando la página limpia el valor", async () => {
    const { rerender } = render(<CompetitionSelector value="c1" />);
    expect(await screen.findByRole("combobox")).toHaveTextContent("Liga Alevín");

    rerender(<CompetitionSelector value={undefined} />);

    await waitFor(() =>
      expect(screen.getByRole("combobox")).not.toHaveTextContent("Liga Alevín"),
    );
  });
});
