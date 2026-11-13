import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("../DeconvocationRulesDialog", () => ({
  __esModule: true,
  default: ({ open, onSaved }: { open: boolean; onSaved: () => void }) =>
    open ? (
      <div role="dialog" aria-label="Reglas">
        <button onClick={onSaved}>Guardar reglas</button>
      </div>
    ) : null,
}));

import ConvocationTab from "../ConvocationTab";
import { DEFAULT_RULES } from "../../utils/rules/defaultRules";
import type { DeconvokeProposal } from "../../utils/deconvokeProposal";

const proposal: DeconvokeProposal = {
  generatedAt: "2026-10-14T10:00:00.000Z",
  targetCount: 0,
  calledCount: 0,
  selectedIds: [],
  previousRivalResult: null,
  players: [],
  positionWarnings: [],
  alreadyDeconvoked: [],
};

function renderTab(extra: Partial<React.ComponentProps<typeof ConvocationTab>> = {}) {
  render(
    <ConvocationTab
      mgmtEventId="event-1"
      mgmtLoadingConv={false}
      loadingPlayers={false}
      teamAvgRating={null}
      mgmtCalled={[]}
      mgmtAvailable={[]}
      mgmtNotCalled={[]}
      players={[]}
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
      onApplyProposal={async () => {}}

      {...extra}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /proponer desconvocados/i }));
}

describe("ConvocationTab - reglas de la propuesta", () => {
  it("el botón Actualizar regenera la propuesta con las reglas vigentes", async () => {
    const onRefreshProposal = vi.fn().mockResolvedValue(undefined);
    renderTab({ onRefreshProposal });

    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));

    await waitFor(() => expect(onRefreshProposal).toHaveBeenCalledTimes(1));
  });

  it("no muestra Actualizar si no hay forma de refrescar la propuesta", () => {
    renderTab();
    expect(screen.queryByRole("button", { name: "Actualizar" })).not.toBeInTheDocument();
  });

  it("el botón Reglas abre la configuración", () => {
    renderTab({ teamId: "t1", rules: DEFAULT_RULES, onRefreshProposal: vi.fn().mockResolvedValue(undefined) });

    fireEvent.click(screen.getByRole("button", { name: "Reglas" }));

    expect(screen.getByRole("dialog", { name: "Reglas" })).toBeInTheDocument();
  });

  it("tras guardar las reglas se actualiza la propuesta", async () => {
    const onRefreshProposal = vi.fn().mockResolvedValue(undefined);
    renderTab({ teamId: "t1", rules: DEFAULT_RULES, onRefreshProposal });

    fireEvent.click(screen.getByRole("button", { name: "Reglas" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar reglas" }));

    await waitFor(() => expect(onRefreshProposal).toHaveBeenCalledTimes(1));
  });

  it("no muestra Reglas sin equipo", () => {
    renderTab({ rules: DEFAULT_RULES });
    expect(screen.queryByRole("button", { name: "Reglas" })).not.toBeInTheDocument();
  });
});
