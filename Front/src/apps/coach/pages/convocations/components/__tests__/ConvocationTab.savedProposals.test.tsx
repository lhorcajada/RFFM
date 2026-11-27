import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

vi.mock("../../../../services/deconvocationProposalService", () => ({
  getSavedProposals: vi.fn(),
  saveProposal: vi.fn(),
  deleteSavedProposal: vi.fn(),
}));

import { getSavedProposals } from "../../../../services/deconvocationProposalService";
import type { PlayerResponse } from "../../../../services/teamplayerService";
import type { DeconvokeProposal } from "../../utils/deconvokeProposal";
import ConvocationTab from "../ConvocationTab";

const player = (id: string, alias: string) =>
  ({ id, name: alias, lastName: "", alias, dorsal: null, position: "Delantero", isInjured: false }) as unknown as PlayerResponse;

const proposal = {
  generatedAt: "2026-11-27T00:00:00Z",
  rivalDifficulty: "medium",
  schedule: { upcoming: [], reservedIn: null, reservedNames: [], strongCount: 0, maxStrong: 0 },
  targetCount: 0,
  calledCount: 2,
  selectedIds: [],
  previousRivalResult: null,
  players: [],
  positionWarnings: [],
  alreadyDeconvoked: [{ playerId: "p2", displayName: "Bea Dos", position: null, positionRole: null }],
  order: [],
} as unknown as DeconvokeProposal;

function renderTab(readOnly = false) {
  const onApplyProposal = vi.fn().mockResolvedValue(undefined);
  render(
    <ConvocationTab
      mgmtEventId="event-1"
      mgmtLoadingConv={false}
      loadingPlayers={false}
      teamAvgRating={null}
      mgmtCalled={["p1"]}
      mgmtAvailable={[]}
      mgmtNotCalled={["p2"]}
      players={[player("p1", "Ana Uno"), player("p2", "Bea Dos")]}
      mgmtRatings={{}}
      mgmtPhotos={{}}
      mgmtExcuseMap={{}}
      excuseTypes={[]}
      mgmtDragPlayer={null}
      mgmtDragOver={null}
      onDragStart={() => {}}
      onDragEnd={() => {}}
      onDragOver={() => {}}
      onDragLeave={() => {}}
      onDrop={() => {}}
      onExcuseChange={() => {}}
      proposal={proposal}
      proposalLoading={false}
      onApplyProposal={onApplyProposal}
      readOnly={readOnly}
    />,
  );
  return { onApplyProposal };
}

describe("ConvocationTab · propuestas guardadas", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getSavedProposals).mockResolvedValue([
      { id: "s1", name: "Sin Ana", teamPlayerIds: ["p1"], createdOn: "2026-11-27T10:00:00Z" },
    ]);
  });

  it("no pide las guardadas hasta abrir la propuesta", () => {
    renderTab();

    expect(getSavedProposals).not.toHaveBeenCalled();
  });

  it("al abrir la propuesta carga las guardadas, y aplicar una la ejecuta y cierra la propuesta", async () => {
    const { onApplyProposal } = renderTab();
    fireEvent.click(screen.getByRole("button", { name: /proponer desconvocados/i }));

    fireEvent.click(await screen.findByRole("button", { name: "Aplicar Sin Ana" }));
    const dialog = screen.getByRole("dialog", { name: "Aplicar «Sin Ana»" });
    expect(dialog).toHaveTextContent("Se desconvocará por decisión técnica a: Ana Uno.");
    expect(dialog).toHaveTextContent("Ya están desconvocados y seguirán fuera: Bea Dos.");
    fireEvent.click(within(dialog).getByRole("button", { name: "Aplicar" }));

    expect(getSavedProposals).toHaveBeenCalledWith("event-1");
    expect(onApplyProposal).toHaveBeenCalledWith(["p1"]);
    await waitFor(() =>
      expect(screen.queryByRole("region", { name: "Propuestas guardadas" })).not.toBeInTheDocument(),
    );
  });
});
