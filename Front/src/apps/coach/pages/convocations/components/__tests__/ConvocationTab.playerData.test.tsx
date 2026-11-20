import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import ConvocationTab from "../ConvocationTab";
import type { PlayerResponse } from "../../../../services/teamplayerService";
import type { ExcuseType } from "../../../../services/excuseTypeService";
import type { DeconvokeProposal, PlayerProposal } from "../../utils/deconvokeProposal";

const players = [
  { id: "p-wait", name: "Daniel", lastName: "Ruiz", alias: null, dorsal: 7, position: "Delantero", isInjured: false },
  { id: "p-called", name: "Hugo", lastName: "Martin", alias: null, dorsal: 1, position: "Portero", isInjured: false },
  { id: "p-out", name: "Ivan", lastName: "Torres", alias: null, dorsal: 10, position: "Medio", isInjured: false },
] as unknown as PlayerResponse[];

const excuseTypes = [{ id: 2, name: "Decisión técnica" }] as unknown as ExcuseType[];

const proposalPlayer = (playerId: string, displayName: string): PlayerProposal =>
  ({
    playerId,
    displayName,
    position: "Portero",
    positionRole: "goalkeeper",
    calledCount: 7,
    startsCount: 4,
    startsDataAvailable: true,
    minRequiredCalls: 6,
    weeklyTraining: { attendedTrainings: 2, totalTrainings: 3 },
    decision: {
      group: "protected",
      reason: "MOTIVO DE LA PROPUESTA",
      compare: "COMPARACION CON OTRO JUGADOR",
      criterion: "fit",
    },
    detail: [
      { rule: "Mínimo de convocatorias", value: "7 de 6 exigidas", result: "doesNotProtect" },
      { rule: "Mínimo por posición", value: "TEXTO DE MOTIVO POSICION", result: "protects" },
    ],
    fit: { share: 1, place: 1, total: 2, positionLabel: "Portero", position: "goalkeeper", value: 4.2 },
    comparison: [],
  }) as unknown as PlayerProposal;

const proposal = {
  targetCount: 0,
  calledCount: 0,
  previousRivalResult: null,
  players: [proposalPlayer("p-called", "Hugo Martin"), proposalPlayer("p-wait", "Daniel Ruiz")],
  alreadyDeconvoked: [],
} as unknown as DeconvokeProposal;

const onMoveToWaiting = vi.fn();

type Options = { isLeagueMatch?: boolean; readOnly?: boolean; withMoveToWaiting?: boolean; fitContext?: boolean };

function renderTab({ isLeagueMatch = true, readOnly = false, withMoveToWaiting = true, fitContext = true }: Options = {}) {
  return render(
    <ConvocationTab
      mgmtEventId="event-1"
      mgmtLoadingConv={false}
      loadingPlayers={false}
      teamAvgRating={null}
      isLeagueMatch={isLeagueMatch}
      mgmtWaiting={["p-wait"]}
      mgmtAvailabilityPending={[]}
      mgmtAvailable={[]}
      mgmtCalled={["p-called"]}
      mgmtNotCalled={["p-out"]}
      players={players}
      mgmtRatings={{}}
      mgmtPhotos={{}}
      mgmtExcuseMap={{ "p-out": 2 }}
      excuseTypes={excuseTypes}
      mgmtDragPlayer={null}
      mgmtDragOver={null}
      onDragStart={() => {}}
      onDragEnd={() => {}}
      onDragOver={() => {}}
      onDragLeave={() => {}}
      onDrop={() => {}}
      onExcuseChange={() => {}}
      onCallPlayers={vi.fn()}
      onDeconvokePlayer={vi.fn()}
      onMoveToWaiting={withMoveToWaiting ? onMoveToWaiting : undefined}
      proposal={proposal}
      proposalLoading={false}
      onApplyProposal={async () => {}}
      fitContext={fitContext ? { positionFit: [], traitRatings: [] } : undefined}
      readOnly={readOnly}
    />,
  );
}

describe("ConvocationTab — pasar un convocado a la lista de espera", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onMoveToWaiting.mockResolvedValue(undefined);
  });

  it("ofrece pasar a la lista de espera a un convocado de liga y lo ejecuta", () => {
    renderTab();

    fireEvent.click(screen.getByRole("button", { name: "Pasar a la lista de espera a Hugo Martin" }));

    expect(onMoveToWaiting).toHaveBeenCalledWith("p-called");
  });

  it("no lo ofrece en un amistoso", () => {
    renderTab({ isLeagueMatch: false });

    expect(screen.queryByRole("button", { name: /Pasar a la lista de espera/ })).not.toBeInTheDocument();
  });

  it("no lo ofrece si no se da la acción", () => {
    renderTab({ withMoveToWaiting: false });

    expect(screen.queryByRole("button", { name: /Pasar a la lista de espera/ })).not.toBeInTheDocument();
  });

  it("no lo ofrece en solo lectura", () => {
    renderTab({ readOnly: true });

    expect(screen.queryByRole("button", { name: /Pasar a la lista de espera/ })).not.toBeInTheDocument();
  });

  it("no lo ofrece a los jugadores de la lista de espera ni a los desconvocados", () => {
    renderTab();

    const waiting = screen.getByRole("region", { name: "Lista de espera" });
    const out = screen.getByRole("region", { name: "Desconvocados" });
    expect(within(waiting).queryByRole("button", { name: /Pasar a la lista de espera/ })).not.toBeInTheDocument();
    expect(within(out).queryByRole("button", { name: /Pasar a la lista de espera/ })).not.toBeInTheDocument();
  });
});

describe("ConvocationTab — datos de la propuesta de cada jugador", () => {
  it("muestra los datos en los que se basa la propuesta, sin su motivo", () => {
    renderTab();

    fireEvent.click(screen.getByRole("button", { name: "Ver datos de Hugo Martin" }));

    const dialog = screen.getByRole("dialog", { name: /Datos de Hugo Martin/ });
    expect(within(dialog).getByText("7 conv.")).toBeInTheDocument();
    expect(within(dialog).getByText("4 tit.")).toBeInTheDocument();
    expect(within(dialog).getByText("Mín. conv: 6")).toBeInTheDocument();
    expect(within(dialog).getByText("2/3 entrenos")).toBeInTheDocument();
    expect(within(dialog).getByText("7 de 6 exigidas")).toBeInTheDocument();
    expect(screen.queryByText("MOTIVO DE LA PROPUESTA")).not.toBeInTheDocument();
    expect(screen.queryByText("COMPARACION CON OTRO JUGADOR")).not.toBeInTheDocument();
    expect(screen.queryByText("TEXTO DE MOTIVO POSICION")).not.toBeInTheDocument();
    expect(screen.queryByText(/Elegido por/)).not.toBeInTheDocument();
  });

  it("también está en la lista de espera", () => {
    renderTab();

    const waiting = screen.getByRole("region", { name: "Lista de espera" });
    expect(within(waiting).getByRole("button", { name: "Ver datos de Daniel Ruiz" })).toBeInTheDocument();
  });

  it("permite ver el encaje del jugador desde sus datos", () => {
    renderTab();

    fireEvent.click(screen.getByRole("button", { name: "Ver datos de Hugo Martin" }));
    fireEvent.click(screen.getByRole("button", { name: "Ver encaje de Hugo Martin" }));

    expect(screen.getByRole("dialog", { name: /Encaje de Hugo Martin como Portero/ })).toBeInTheDocument();
  });

  it("no ofrece el encaje sin los datos de encaje del equipo", () => {
    renderTab({ fitContext: false });

    fireEvent.click(screen.getByRole("button", { name: "Ver datos de Hugo Martin" }));

    expect(screen.queryByRole("button", { name: "Ver encaje de Hugo Martin" })).not.toBeInTheDocument();
  });

  it("no ofrece datos de un desconvocado, que no entra en la propuesta", () => {
    renderTab();

    expect(screen.queryByRole("button", { name: "Ver datos de Ivan Torres" })).not.toBeInTheDocument();
  });

  it("no ofrece datos en solo lectura", () => {
    renderTab({ readOnly: true });

    expect(screen.queryByRole("button", { name: /Ver datos de/ })).not.toBeInTheDocument();
  });
});
