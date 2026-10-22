import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TacticalBoardState } from "../../hooks/useTacticalBoard";
import ChapasStrip from "../ChapasStrip";

const makePlayer = (id: string, position: string | null, dorsal: number) => ({
  id,
  name: id,
  alias: id,
  position,
  dorsal,
});

const makeBoard = (players: ReturnType<typeof makePlayer>[], overrides: Partial<TacticalBoardState> = {}): TacticalBoardState =>
  ({
    loadingPlayers: false,
    chapasError: null,
    availablePlayersForStrip: players,
    anonymousChapaOptions: [],
    handleRosterChapaDragStart: vi.fn(),
    handleRosterChapaDragEnd: vi.fn(),
    handleAnonymousChapaDragStart: vi.fn(),
    hideChapaNames: false,
    toggleHideChapaNames: vi.fn(),
    ...overrides,
  }) as unknown as TacticalBoardState;

describe("ChapasStrip", () => {
  it("permite ocultar los nombres de todas las chapas del campo", () => {
    const toggleHideChapaNames = vi.fn();
    render(<ChapasStrip board={makeBoard([], { toggleHideChapaNames })} />);

    const toggle = screen.getByRole("checkbox", { name: "Mostrar nombres" });
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);

    expect(toggleHideChapaNames).toHaveBeenCalledTimes(1);
  });

  it("refleja que los nombres están ocultos a nivel general", () => {
    render(<ChapasStrip board={makeBoard([], { hideChapaNames: true })} />);
    expect(screen.getByRole("checkbox", { name: "Mostrar nombres" })).not.toBeChecked();
  });

  it("muestra un título por cada posición presente, en orden de línea", () => {
    render(
      <ChapasStrip
        board={makeBoard([
          makePlayer("por1", "Portero", 1),
          makePlayer("def3", "Lateral izquierdo", 3),
          makePlayer("del9", "Delantero", 9),
          makePlayer("sinPos", null, 20),
        ])}
      />,
    );

    const titles = screen.getAllByRole("heading").map((h) => h.textContent);
    expect(titles).toEqual(["Porteros", "Defensas", "Delanteros", "Otros"]);
  });

  it("agrupa cada chapa bajo el título de su posición", () => {
    render(
      <ChapasStrip
        board={makeBoard([
          makePlayer("def3", "Defensa", 3),
          makePlayer("def4", "Central", 4),
          makePlayer("med8", "Mediocentro", 8),
        ])}
      />,
    );

    const defensas = screen.getByRole("group", { name: "Defensas" });
    expect(within(defensas).getByText("def3")).toBeInTheDocument();
    expect(within(defensas).getByText("def4")).toBeInTheDocument();
    expect(within(defensas).queryByText("med8")).not.toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Medios" })).getByText("med8")).toBeInTheDocument();
  });
});
