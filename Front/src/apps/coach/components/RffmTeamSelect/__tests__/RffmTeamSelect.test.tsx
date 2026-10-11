import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetGroupTeams = vi.fn();
vi.mock("../../../services/rffmCompetitionService", () => ({
  default: {
    getGroupTeams: (...args: unknown[]) => mockGetGroupTeams(...args),
  },
}));

import RffmTeamSelect from "../RffmTeamSelect";

describe("RffmTeamSelect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetGroupTeams.mockResolvedValue([
      { teamCode: "9001", teamName: "CD Ejemplo A" },
      { teamCode: "9002", teamName: "UD Rival B" },
    ]);
  });

  it("carga y muestra los equipos del grupo elegido", async () => {
    render(<RffmTeamSelect competitionId={1} groupId={10} teamCode={null} />);

    await waitFor(() => expect(mockGetGroupTeams).toHaveBeenCalledWith(1, 10));
    await userEvent.click(screen.getByLabelText("Equipo RFFM"));
    expect(await screen.findByRole("option", { name: "CD Ejemplo A" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "UD Rival B" })).toBeInTheDocument();
  });

  it("notifica el código del equipo seleccionado", async () => {
    const onChange = vi.fn();
    render(<RffmTeamSelect competitionId={1} groupId={10} teamCode={null} onChange={onChange} />);

    await waitFor(() => expect(mockGetGroupTeams).toHaveBeenCalled());
    await userEvent.click(screen.getByLabelText("Equipo RFFM"));
    await userEvent.click(await screen.findByRole("option", { name: "UD Rival B" }));

    expect(onChange).toHaveBeenCalledWith("9002");
  });

  it("permite quitar el equipo seleccionado", async () => {
    const onChange = vi.fn();
    render(<RffmTeamSelect competitionId={1} groupId={10} teamCode="9001" onChange={onChange} />);

    await userEvent.click(await screen.findByLabelText("Equipo RFFM"));
    await userEvent.click(await screen.findByRole("option", { name: "-- Sin equipo --" }));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("muestra el equipo ya guardado", async () => {
    render(<RffmTeamSelect competitionId={1} groupId={10} teamCode="9001" />);

    expect(await screen.findByText("CD Ejemplo A")).toBeInTheDocument();
  });

  it("no carga equipos y queda deshabilitado mientras no haya grupo", async () => {
    render(<RffmTeamSelect competitionId={1} groupId={null} teamCode={null} />);

    expect(mockGetGroupTeams).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Equipo RFFM").closest("div")).toHaveAttribute("aria-disabled", "true");
  });

  it("muestra un mensaje de error cuando falla la carga de equipos", async () => {
    mockGetGroupTeams.mockRejectedValue(new Error("boom"));

    render(<RffmTeamSelect competitionId={1} groupId={10} teamCode={null} />);

    expect(await screen.findByText("No se han podido cargar los equipos del grupo.")).toBeInTheDocument();
  });
});
