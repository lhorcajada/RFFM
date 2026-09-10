import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

describe("ConvocationCard - selección para notificar por WhatsApp", () => {
  it("no renderiza checkbox cuando selectable no se proporciona (regresión para los 4 call sites existentes)", () => {
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

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("no renderiza checkbox cuando selectable es falso", () => {
    render(
      <MemoryRouter>
        <ConvocationCard
          conv={baseConv()}
          statuses={statuses}
          excuseTypes={[]}
          canEdit={true}
          selectable={false}
          onChangeStatus={vi.fn()}
          onDelete={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("renderiza el checkbox y refleja 'selected' cuando selectable es verdadero", () => {
    render(
      <MemoryRouter>
        <ConvocationCard
          conv={baseConv()}
          statuses={statuses}
          excuseTypes={[]}
          canEdit={true}
          selectable={true}
          selected={true}
          onToggleSelect={vi.fn()}
          onChangeStatus={vi.fn()}
          onDelete={vi.fn()}
        />
      </MemoryRouter>
    );

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toBeChecked();
  });

  it("llama a onToggleSelect con el teamPlayerId de la card (conv.player.id), no con el id de la convocatoria", async () => {
    const onToggleSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ConvocationCard
          conv={baseConv()}
          statuses={statuses}
          excuseTypes={[]}
          canEdit={true}
          selectable={true}
          selected={false}
          onToggleSelect={onToggleSelect}
          onChangeStatus={vi.fn()}
          onDelete={vi.fn()}
        />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("checkbox"));

    expect(onToggleSelect).toHaveBeenCalledWith("player-1");
  });
});
