import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DndContext } from "@dnd-kit/core";
import {
  BenchPlayerCard,
  DroppableBench,
  BENCH_POSITION_GROUPS,
  groupBenchPlayers,
} from "../BenchPlayerCard";
import type { SquadPlayer } from "../../../../squad/components/IdealLineup";

function makePlayer(overrides: Partial<SquadPlayer> = {}): SquadPlayer {
  return {
    id: "p1",
    displayName: "Jugador Uno",
    dorsal: 7,
    position: "Centrocampista",
    competitiveness: 9,
    streakCount: 3,
    readiness: 40,
    fatigue: 10,
    ...overrides,
  };
}

describe("BenchPlayerCard - tarjeta rica de banquillo (contenido intacto)", () => {
  it("muestra foto/iniciales, dorsal, nombre, competitividad, racha, minutos y barras de forma", () => {
    render(
      <BenchPlayerCard
        player={makePlayer()}
        isDragActive={false}
        isLeaving={false}
        minutesPlayed={23}
        hasPlayed
      />,
    );

    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("Jugador Uno")).toBeInTheDocument();
    expect(
      screen.getByText((_, el) => el?.textContent?.replace(/\s+/g, " ").trim() === "Comp. 9"),
    ).toBeInTheDocument();
    expect(screen.getByText("⏱ 3")).toBeInTheDocument();
    expect(screen.getByText("23'")).toBeInTheDocument();
    expect(screen.getByTestId("player-form-bar-ef")).toBeInTheDocument();
  });

  it("muestra el badge SALE en vez de los minutos cuando isLeaving", () => {
    render(
      <BenchPlayerCard
        player={makePlayer()}
        isDragActive={false}
        isLeaving
        minutesPlayed={23}
        hasPlayed
      />,
    );

    expect(screen.getByText("SALE")).toBeInTheDocument();
    expect(screen.queryByText("23'")).not.toBeInTheDocument();
  });

  it("muestra un guion en el badge de minutos cuando el jugador no ha jugado", () => {
    const { container } = render(
      <BenchPlayerCard
        player={makePlayer()}
        isDragActive={false}
        isLeaving={false}
        minutesPlayed={0}
        hasPlayed={false}
      />,
    );

    expect(container.querySelector(".benchNoPlayTag, [class*='benchNoPlayTag']")).toHaveTextContent("—");
  });
});

describe("groupBenchPlayers", () => {
  it("agrupa jugadores por posición usando BENCH_POSITION_GROUPS", () => {
    const players = [
      makePlayer({ id: "gk", position: "Portero" }),
      makePlayer({ id: "def", position: "Defensa central" }),
      makePlayer({ id: "mid", position: "Centrocampista" }),
    ];

    const groups = groupBenchPlayers(players);
    const labels = groups.map((g) => g.label);

    expect(labels).toEqual(
      expect.arrayContaining(["Porteros", "Defensas", "Centrocampistas"]),
    );
    expect(groups.every((g) => g.players.length > 0)).toBe(true);
  });

  it("agrupa posiciones no reconocidas en 'Sin posición' solo cuando hay alguna", () => {
    const players = [makePlayer({ id: "x", position: "Comodín raro" })];
    const groups = groupBenchPlayers(players);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Sin posición");
  });

  it("BENCH_POSITION_GROUPS expone las 4 categorías base", () => {
    expect(BENCH_POSITION_GROUPS.map((g) => g.label)).toEqual([
      "Porteros",
      "Defensas",
      "Centrocampistas",
      "Delanteros",
    ]);
  });
});

describe("DroppableBench - mecanismo de arrastre intacto", () => {
  it("DroppableBench renderiza sus children dentro de la zona droppable", () => {
    render(
      <DndContext>
        <DroppableBench>
          <span>contenido del banquillo</span>
        </DroppableBench>
      </DndContext>,
    );
    expect(screen.getByText("contenido del banquillo")).toBeInTheDocument();
  });
});
