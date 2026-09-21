import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

let mockChangeToken = 0;

vi.mock("../../../../../shared/context/RffmSeasonContext", () => ({
  useRffmSeason: () => ({
    seasonId: 22,
    seasons: [{ id: 22, label: "2026-2027" }],
    seasonChangeToken: mockChangeToken,
    setSeasonId: vi.fn(),
    applySeasonId: vi.fn(),
  }),
}));

vi.mock("../../../services/Federation/CompetitionService", () => ({
  competitionService: { searchTeams: vi.fn() },
}));

vi.mock("../../../../../shared/components/ui/CompetitionSelector/CompetitionSelector", () => ({
  default: ({
    onChange,
    value,
  }: {
    onChange: (c?: { id: string; name: string; categoryGroup: string }) => void;
    value?: string;
  }) => (
    <div>
      <button
        onClick={() =>
          onChange({ id: "100", name: "Liga Alevín", categoryGroup: "Alevín" })
        }
      >
        elegir-competicion
      </button>
      <span data-testid="competition-value">{value ?? ""}</span>
    </div>
  ),
}));

import { competitionService } from "../../../services/Federation/CompetitionService";
import ClubSearchSection from "../ClubSearchSection";

const match = (teamCode: string, teamName: string, groupCode = "g2") => ({
  teamCode,
  teamName,
  groupCode,
  groupName: `Grupo ${groupCode}`,
  competitionCode: "100",
  competitionName: "Liga Alevín",
});

function fillAndSearch(name = "alcorcon") {
  fireEvent.click(screen.getByText("elegir-competicion"));
  fireEvent.change(screen.getByLabelText("Nombre del equipo"), {
    target: { value: name },
  });
  fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
}

describe("ClubSearchSection — búsqueda por temporada, competición y nombre del equipo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChangeToken = 0;
  });

  it("no permite buscar hasta elegir competición y escribir el nombre", () => {
    render(<ClubSearchSection onTeamResolved={() => {}} />);
    expect(screen.getByRole("button", { name: "Buscar" })).toBeDisabled();

    fireEvent.click(screen.getByText("elegir-competicion"));
    expect(screen.getByRole("button", { name: "Buscar" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Nombre del equipo"), {
      target: { value: "alcorcon" },
    });
    expect(screen.getByRole("button", { name: "Buscar" })).toBeEnabled();
  });

  it("busca en la competición elegida con la temporada RFFM seleccionada", async () => {
    vi.mocked(competitionService.searchTeams).mockResolvedValue([]);
    render(<ClubSearchSection onTeamResolved={() => {}} />);

    fillAndSearch("alcorcon");

    await waitFor(() =>
      expect(competitionService.searchTeams).toHaveBeenCalledWith(
        "100",
        "alcorcon",
        22,
      ),
    );
  });

  it("si solo hay un equipo lo propone directamente con su grupo y competición", async () => {
    vi.mocked(competitionService.searchTeams).mockResolvedValue([
      match("t1", "AD Alcorcón"),
    ]);
    const onTeamResolved = vi.fn();
    render(<ClubSearchSection onTeamResolved={onTeamResolved} />);

    fillAndSearch();

    await waitFor(() =>
      expect(onTeamResolved).toHaveBeenCalledWith({
        competition: { id: "100", name: "Liga Alevín" },
        group: { id: "g2", name: "Grupo g2" },
        team: { id: "t1", name: "AD Alcorcón" },
      }),
    );
  });

  it("si hay varios equipos deja elegir cuál usar", async () => {
    vi.mocked(competitionService.searchTeams).mockResolvedValue([
      match("t1", "Getafe A"),
      match("t2", "Getafe B"),
    ]);
    const onTeamResolved = vi.fn();
    render(<ClubSearchSection onTeamResolved={onTeamResolved} />);

    fillAndSearch("getafe");

    fireEvent.click(await screen.findByText(/Getafe B/));
    expect(onTeamResolved).toHaveBeenCalledTimes(1);
    expect(onTeamResolved).toHaveBeenCalledWith(
      expect.objectContaining({ team: { id: "t2", name: "Getafe B" } }),
    );
  });

  it("avisa cuando el equipo no está en ningún grupo de la competición", async () => {
    vi.mocked(competitionService.searchTeams).mockResolvedValue([]);
    render(<ClubSearchSection onTeamResolved={() => {}} />);

    fillAndSearch();

    expect(
      await screen.findByText(/No se encontró ningún equipo/),
    ).toBeInTheDocument();
  });

  it("avisa si la búsqueda falla", async () => {
    vi.mocked(competitionService.searchTeams).mockRejectedValue(new Error("500"));
    render(<ClubSearchSection onTeamResolved={() => {}} />);

    fillAndSearch();

    expect(
      await screen.findByText(/No se pudo realizar la búsqueda/),
    ).toBeInTheDocument();
  });

  it("limpia competición y resultados cuando el usuario cambia de temporada", async () => {
    vi.mocked(competitionService.searchTeams).mockResolvedValue([
      match("t1", "Getafe A"),
      match("t2", "Getafe B"),
    ]);
    const { rerender } = render(<ClubSearchSection onTeamResolved={() => {}} />);
    fillAndSearch("getafe");
    await screen.findByText(/Getafe B/);
    expect(screen.getByTestId("competition-value")).toHaveTextContent("100");

    mockChangeToken = 1;
    rerender(<ClubSearchSection onTeamResolved={() => {}} />);

    await waitFor(() => {
      expect(screen.queryByText(/Getafe B/)).not.toBeInTheDocument();
      expect(screen.getByTestId("competition-value")).toBeEmptyDOMElement();
    });
  });
});
