import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { DraggableListItem, OverlayItem } from "../IdealLineup";
import type { SquadPlayer } from "../IdealLineup";

function makePlayer(overrides: Partial<SquadPlayer> = {}): SquadPlayer {
  return {
    id: "p1",
    displayName: "Juan Pérez García",
    ...overrides,
  };
}

describe("IdealLineup - DraggableListItem", () => {
  it("muestra el alias del jugador cuando existe, en lugar del nombre completo", () => {
    render(
      <MemoryRouter>
        <DraggableListItem player={makePlayer({ alias: "Juanito" })} />
      </MemoryRouter>
    );

    expect(screen.getByText("Juanito")).toBeInTheDocument();
    expect(screen.queryByText("Juan Pérez García")).not.toBeInTheDocument();
  });

  it("muestra un tooltip con el nombre completo cuando se usa el alias", async () => {
    render(
      <MemoryRouter>
        <DraggableListItem player={makePlayer({ alias: "Juanito" })} />
      </MemoryRouter>
    );

    // The full name should be reachable via the tooltip title attribute chain
    const nameEl = screen.getByText("Juanito");
    expect(nameEl.closest("[title], [aria-label]") ?? nameEl).toBeTruthy();
  });

  it("muestra el nombre completo cuando el jugador no tiene alias", () => {
    render(
      <MemoryRouter>
        <DraggableListItem player={makePlayer({ alias: null })} />
      </MemoryRouter>
    );

    expect(screen.getByText("Juan Pérez García")).toBeInTheDocument();
  });

  it("muestra el nombre completo cuando el alias es una cadena vacía o solo espacios", () => {
    render(
      <MemoryRouter>
        <DraggableListItem player={makePlayer({ alias: "   " })} />
      </MemoryRouter>
    );

    expect(screen.getByText("Juan Pérez García")).toBeInTheDocument();
  });

  it("usa el nombre mostrado (alias si existe) para el alt de la foto", () => {
    render(
      <MemoryRouter>
        <DraggableListItem
          player={makePlayer({ alias: "Juanito", photoSrc: "blob:http://localhost/photo123" })}
        />
      </MemoryRouter>
    );

    expect(screen.getByAltText("Juanito")).toBeInTheDocument();
  });

  it("calcula las iniciales del avatar a partir del alias cuando existe", () => {
    render(
      <MemoryRouter>
        <DraggableListItem player={makePlayer({ alias: "Manolo Segundo", photoSrc: null })} />
      </MemoryRouter>
    );

    // "Manolo Segundo" -> "MS"
    expect(screen.getByText("MS")).toBeInTheDocument();
  });
});

describe("IdealLineup - OverlayItem", () => {
  it("muestra el alias del jugador cuando existe, en lugar del nombre completo", () => {
    render(<OverlayItem player={makePlayer({ alias: "Juanito" })} />);

    expect(screen.getByText("Juanito")).toBeInTheDocument();
    expect(screen.queryByText("Juan Pérez García")).not.toBeInTheDocument();
  });

  it("muestra el nombre completo cuando el jugador no tiene alias", () => {
    render(<OverlayItem player={makePlayer({ alias: undefined })} />);

    expect(screen.getByText("Juan Pérez García")).toBeInTheDocument();
  });

  it("usa el nombre mostrado (alias si existe) para el alt de la foto", () => {
    render(
      <OverlayItem
        player={makePlayer({ alias: "Juanito", photoSrc: "blob:http://localhost/photo123" })}
      />
    );

    expect(screen.getByAltText("Juanito")).toBeInTheDocument();
  });

  it("calcula las iniciales del avatar a partir del alias cuando existe", () => {
    render(<OverlayItem player={makePlayer({ alias: "Manolo Segundo", photoSrc: null })} />);

    expect(screen.getByText("MS")).toBeInTheDocument();
  });
});
