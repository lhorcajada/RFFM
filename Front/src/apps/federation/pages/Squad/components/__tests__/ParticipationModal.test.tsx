import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ParticipationModal from "../ParticipationModal";
import type { TeamParticipationSummaryItem } from "../../../../types/participation";

const data: TeamParticipationSummaryItem[] = [
  { seasonId: 22, seasonName: "2026-2027", competitionName: "Liga", groupName: "Grupo 1", teamName: "Equipo Y", count: 1 },
  { seasonId: 21, seasonName: "2025-2026", competitionName: "Liga", groupName: "Grupo 2", teamName: "Equipo X", count: 2 },
];

describe("ParticipationModal", () => {
  it("agrupa las participaciones por temporada", () => {
    render(<ParticipationModal open onClose={vi.fn()} loading={false} data={data} />);

    const current = screen.getByRole("region", { name: "Temporada 2026-2027" });
    const previous = screen.getByRole("region", { name: "Temporada 2025-2026" });
    expect(within(current).getByText(/Equipo Y/)).toBeInTheDocument();
    expect(within(previous).getByText(/Equipo X/)).toBeInTheDocument();
    expect(within(current).queryByText(/Equipo X/)).not.toBeInTheDocument();
  });

  it("sin participaciones muestra el estado vacío", () => {
    render(<ParticipationModal open onClose={vi.fn()} loading={false} data={[]} />);

    expect(screen.getByText(/no hay participaciones registradas/i)).toBeInTheDocument();
  });
});
