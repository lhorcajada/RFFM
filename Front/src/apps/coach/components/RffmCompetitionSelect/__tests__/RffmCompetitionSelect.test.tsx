import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetCompetitions = vi.fn();
const mockGetGroups = vi.fn();
vi.mock("../../../services/rffmCompetitionService", () => ({
  default: {
    getCompetitions: (...args: unknown[]) => mockGetCompetitions(...args),
    getGroups: (...args: unknown[]) => mockGetGroups(...args),
  },
}));

import RffmCompetitionSelect from "../RffmCompetitionSelect";

describe("RffmCompetitionSelect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCompetitions.mockResolvedValue([
      { id: 1, name: "Liga Nacional", categoryGroup: "Cadete" },
      { id: 2, name: "Liga Regional", categoryGroup: "Infantil" },
    ]);
    mockGetGroups.mockResolvedValue([]);
  });

  it("carga y muestra las competiciones reales de RFFM", async () => {
    render(<RffmCompetitionSelect competitionId={null} groupId={null} />);

    await waitFor(() => expect(mockGetCompetitions).toHaveBeenCalled());
    await userEvent.click(screen.getByLabelText("Competición RFFM"));
    expect(await screen.findByRole("option", { name: "Liga Nacional" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Liga Regional" })).toBeInTheDocument();
  });

  it("al elegir una competición, carga y muestra sus grupos", async () => {
    mockGetGroups.mockResolvedValue([
      { id: 10, name: "Grupo A" },
      { id: 11, name: "Grupo B" },
    ]);
    const onChange = vi.fn();

    function Wrapper() {
      const [value, setValue] = React.useState<{
        competitionId: number | null;
        groupId: number | null;
      }>({ competitionId: null, groupId: null });
      return (
        <RffmCompetitionSelect
          competitionId={value.competitionId}
          groupId={value.groupId}
          onChange={(v) => {
            onChange(v);
            setValue(v);
          }}
        />
      );
    }

    render(<Wrapper />);

    await waitFor(() => expect(mockGetCompetitions).toHaveBeenCalled());
    await userEvent.click(screen.getByLabelText("Competición RFFM"));
    await userEvent.click(await screen.findByRole("option", { name: "Liga Nacional" }));

    await waitFor(() => expect(mockGetGroups).toHaveBeenCalledWith(1));
    expect(onChange).toHaveBeenCalledWith({ competitionId: 1, groupId: null });

    await userEvent.click(screen.getByLabelText("Grupo RFFM"));
    expect(await screen.findByRole("option", { name: "Grupo A" })).toBeInTheDocument();
  });

  it("notifica el grupo seleccionado", async () => {
    mockGetGroups.mockResolvedValue([{ id: 10, name: "Grupo A" }]);
    const onChange = vi.fn();

    render(<RffmCompetitionSelect competitionId={1} groupId={null} onChange={onChange} />);

    await waitFor(() => expect(mockGetGroups).toHaveBeenCalledWith(1));
    await userEvent.click(screen.getByLabelText("Grupo RFFM"));
    await userEvent.click(await screen.findByRole("option", { name: "Grupo A" }));

    expect(onChange).toHaveBeenCalledWith({ competitionId: 1, groupId: 10 });
  });

  it("no carga grupos cuando no hay competición seleccionada", async () => {
    render(<RffmCompetitionSelect competitionId={null} groupId={null} />);

    await waitFor(() => expect(mockGetCompetitions).toHaveBeenCalled());
    expect(mockGetGroups).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Grupo RFFM").closest("div")).toHaveAttribute(
      "aria-disabled",
      "true"
    );
  });

  it("muestra un mensaje de error cuando falla la carga de competiciones", async () => {
    mockGetCompetitions.mockRejectedValue(new Error("network down"));

    render(<RffmCompetitionSelect competitionId={null} groupId={null} />);

    expect(await screen.findByText("network down")).toBeInTheDocument();
  });
});
