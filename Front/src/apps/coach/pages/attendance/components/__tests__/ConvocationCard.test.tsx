import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import ConvocationCard from "../ConvocationCard";
import type { ConvocationItem } from "../../../../services/convocationService";

function baseConv(overrides: Partial<ConvocationItem> = {}): ConvocationItem {
  return {
    id: "conv-1",
    status: 1,
    excuseTypeId: null,
    player: {
      id: "player-1",
      playerId: "player-1",
      alias: "Jugador de prueba",
      urlPhoto: null,
    } as any,
    ...overrides,
  } as ConvocationItem;
}

const statuses = [
  { id: 1, name: "Pending" },
  { id: 2, name: "Accepted" },
  { id: 3, name: "Deconvoke" },
];

describe("ConvocationCard - botones de acción en pendientes", () => {
  it("muestra los botones 'Aceptar' y 'Rechazar' (verbo de la acción) para una convocatoria pendiente", () => {
    render(
      <MemoryRouter>
        <ConvocationCard
          conv={baseConv()}
          statuses={statuses}
          excuseTypes={[]}
          canEdit={true}
          onChangeStatus={vi.fn()}
          onDelete={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole("button", { name: "Aceptar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rechazar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aceptado" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rechazado" })).not.toBeInTheDocument();
  });
});
