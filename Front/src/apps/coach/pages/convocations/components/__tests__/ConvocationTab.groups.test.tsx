import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConvocationTab from "../ConvocationTab";
import type { PlayerResponse } from "../../../../services/teamplayerService";
import type { DeconvokeProposal } from "../../utils/deconvokeProposal";

const player = (id: string, alias: string, position: string) =>
  ({ id, name: alias, lastName: "", alias, dorsal: null, position, isInjured: false }) as unknown as PlayerResponse;

const players = [
  player("p-wait", "Jugador Espera", "Portero"),
  player("p-req", "Jugador Pendiente", "Defensa Central"),
  player("p-av", "Jugador Disponible", "Delantero Centro"),
  player("p-called", "Jugador Convocado", "Medio Centro"),
];

const emptyProposal: DeconvokeProposal = { targetCount: 0, calledCount: 0, previousRivalResult: null, players: [] };

function renderTab(isLeagueMatch: boolean) {
  render(
    <ConvocationTab
      mgmtEventId="event-1"
      mgmtLoadingConv={false}
      loadingPlayers={false}
      teamAvgRating={null}
      isLeagueMatch={isLeagueMatch}
      mgmtWaiting={isLeagueMatch ? ["p-wait"] : []}
      mgmtAvailabilityPending={isLeagueMatch ? ["p-req"] : []}
      mgmtAvailable={isLeagueMatch ? ["p-av"] : ["p-wait", "p-req", "p-av"]}
      mgmtCalled={["p-called"]}
      mgmtNotCalled={[]}
      players={players}
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
      proposal={emptyProposal}
      proposalLoading={false}
      onApplyProposal={async () => {}}
      onPrintProposal={async () => {}}
    />
  );
}

describe("ConvocationTab - listas plegables", () => {
  it("en liga muestra las listas vacías plegadas delante y las demás en el orden espera, pendientes de respuesta, disponibles, convocados", () => {
    renderTab(true);

    const titles = screen
      .getAllByRole("button")
      .filter((b) => b.hasAttribute("aria-expanded"))
      .map((b) => b.textContent?.replace(/\d+$/, "").trim());
    expect(titles).toEqual(["Desconvocados", "Lista de espera", "Pendientes de respuesta", "Disponibles", "Convocados"]);
  });

  it("en liga cada jugador aparece en su lista", () => {
    renderTab(true);

    const pending = screen.getByRole("region", { name: "Pendientes de respuesta" });
    expect(within(pending).getByText("Jugador Pendiente")).toBeInTheDocument();
    const available = screen.getByRole("region", { name: "Disponibles" });
    expect(within(available).getByText("Jugador Disponible")).toBeInTheDocument();
    expect(within(available).queryByText("Jugador Espera")).not.toBeInTheDocument();
  });

  it("fuera de liga no muestra las listas de espera ni de pendientes de respuesta", () => {
    renderTab(false);

    expect(screen.queryByRole("button", { name: /^Lista de espera/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Pendientes de respuesta/ })).not.toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Disponibles" })).getByText("Jugador Espera")).toBeInTheDocument();
  });

  it("pliega automáticamente las listas sin jugadores", () => {
    renderTab(true);

    expect(screen.getByRole("button", { name: /^Desconvocados/ })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: /^Convocados/ })).toHaveAttribute("aria-expanded", "true");
  });

  it("una lista vacía se despliega como columna al pulsarla", async () => {
    renderTab(true);

    await userEvent.click(screen.getByRole("button", { name: /^Desconvocados/ }));

    const region = screen.getByRole("region", { name: "Desconvocados" });
    expect(within(region).getByRole("button")).toHaveAttribute("aria-expanded", "true");
  });

  it("se puede plegar y desplegar una lista", async () => {
    renderTab(true);
    const toggle = screen.getByRole("button", { name: /^Disponibles/ });
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Jugador Disponible")).not.toBeInTheDocument();

    await userEvent.click(toggle);
    expect(screen.getByText("Jugador Disponible")).toBeInTheDocument();
  });
});
