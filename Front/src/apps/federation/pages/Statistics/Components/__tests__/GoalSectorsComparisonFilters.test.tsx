import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../services/api", () => ({
  getCompetitions: vi.fn(),
  getGroups: vi.fn(),
  getTeamsForClassification: vi.fn(),
  getSettingsForUser: vi.fn(),
}));

vi.mock("../../../../../../shared/context/UserContext", () => ({
  useUser: () => ({ user: { id: "user-1" } }),
}));

const applySeasonId = vi.fn();
vi.mock("../../../../../../shared/context/RffmSeasonContext", () => ({
  useRffmSeason: () => ({ seasonId: 22, seasonChangeToken: 0, applySeasonId }),
}));

vi.mock("../../../../../../shared/components/ui/RffmSeasonSelector/RffmSeasonSelector", () => ({
  default: () => <div>Temporada RFFM</div>,
}));

import {
  getCompetitions,
  getGroups,
  getSettingsForUser,
  getTeamsForClassification,
} from "../../../../services/api";
import GoalSectorsComparisonFilters, {
  EMPTY_COMPARISON_SELECTION,
  type ComparisonSelection,
} from "../GoalSectorsComparisonFilters";

function Harness() {
  const [value, setValue] = React.useState<ComparisonSelection>(EMPTY_COMPARISON_SELECTION);
  return <GoalSectorsComparisonFilters value={value} onChange={setValue} />;
}

function panel(name: string) {
  return within(screen.getByRole("group", { name }));
}

async function pick(panelName: string, field: RegExp, option: string) {
  fireEvent.mouseDown(await panel(panelName).findByRole("combobox", { name: field }));
  fireEvent.click(await screen.findByRole("option", { name: option }));
}

describe("GoalSectorsComparisonFilters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCompetitions).mockResolvedValue([
      { id: "100", name: "Segunda Cadete", categoryGroup: "Cadete" },
      { id: "300", name: "Primera Infantil", categoryGroup: "Infantil" },
    ]);
    vi.mocked(getGroups).mockImplementation(async (competitionId?: string) =>
      competitionId === "100"
        ? [{ id: "200", name: "Grupo 34" }]
        : [{ id: "400", name: "Grupo 7" }],
    );
    vi.mocked(getTeamsForClassification).mockImplementation(
      async ({ group }) =>
        (group === "200"
          ? [{ teamId: "11", teamName: "Equipo A" }]
          : [{ teamId: "21", teamName: "Equipo B" }]) as never,
    );
    vi.mocked(getSettingsForUser).mockResolvedValue([
      { isPrimary: true, seasonId: 22, competitionId: "100", groupId: "200" },
    ]);
  });

  it("prellena ambos paneles con la combinación principal del usuario", async () => {
    render(<Harness />);

    expect(await panel("Equipo 1").findByText("Grupo 34")).toBeInTheDocument();
    expect(await panel("Equipo 2").findByText("Grupo 34")).toBeInTheDocument();
  });

  it("cambiar la competición del Equipo 2 limpia su grupo y no toca el Equipo 1", async () => {
    render(<Harness />);
    await panel("Equipo 2").findByText("Grupo 34");

    await pick("Equipo 2", /Competición/, "Primera Infantil");

    await waitFor(() => expect(panel("Equipo 2").queryByText("Grupo 34")).not.toBeInTheDocument());
    expect(panel("Equipo 1").getByText("Grupo 34")).toBeInTheDocument();
  });

  it("cada panel carga los equipos de su propia competición y grupo", async () => {
    render(<Harness />);
    await panel("Equipo 2").findByText("Grupo 34");

    await pick("Equipo 2", /Competición/, "Primera Infantil");
    await pick("Equipo 2", /Grupo/, "Grupo 7");
    await pick("Equipo 2", /Equipo/, "Equipo B");

    expect(getTeamsForClassification).toHaveBeenCalledWith({
      season: "22",
      competition: "300",
      group: "400",
    });
    expect(panel("Equipo 2").getByText("Equipo B")).toBeInTheDocument();
  });
});
