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

function deconvokedConv(overrides: Partial<ConvocationItem> = {}): ConvocationItem {
  return baseConv({ status: 3, excuseTypeId: null, ...overrides });
}

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

describe("ConvocationCard - reactivación de una convocatoria desconvocada", () => {
  it("muestra los botones de reactivación cuando canReactivateFromDeconvoke y canEditThisConvocation son verdaderos", () => {
    render(
      <MemoryRouter>
        <ConvocationCard
          conv={deconvokedConv()}
          statuses={statuses}
          excuseTypes={[]}
          canEdit={true}
          canEditThisConvocation={true}
          canReactivateFromDeconvoke={true}
          onChangeStatus={vi.fn()}
          onDelete={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole("button", { name: "Pendiente de aceptar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aceptar" })).toBeInTheDocument();
  });

  it("no renderiza los botones de reactivación cuando canReactivateFromDeconvoke es falso (Player/FamilyMember en evento no-Entrenamiento)", () => {
    render(
      <MemoryRouter>
        <ConvocationCard
          conv={deconvokedConv()}
          statuses={statuses}
          excuseTypes={[]}
          canEdit={true}
          canEditThisConvocation={true}
          canReactivateFromDeconvoke={false}
          onChangeStatus={vi.fn()}
          onDelete={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.queryByRole("button", { name: "Pendiente de aceptar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aceptar" })).not.toBeInTheDocument();
  });

  it("no renderiza los botones de reactivación cuando la convocatoria desconvocada no es del propio jugador (canEditThisConvocation falso)", () => {
    render(
      <MemoryRouter>
        <ConvocationCard
          conv={deconvokedConv()}
          statuses={statuses}
          excuseTypes={[]}
          canEdit={true}
          canEditThisConvocation={false}
          canReactivateFromDeconvoke={true}
          onChangeStatus={vi.fn()}
          onDelete={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.queryByRole("button", { name: "Pendiente de aceptar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aceptar" })).not.toBeInTheDocument();
  });

  it("llama a onChangeStatus con el id de estado 'Accepted' al pulsar el botón 'Aceptar' de reactivación", async () => {
    const onChangeStatus = vi.fn();
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ConvocationCard
          conv={deconvokedConv()}
          statuses={statuses}
          excuseTypes={[]}
          canEdit={true}
          canEditThisConvocation={true}
          canReactivateFromDeconvoke={true}
          onChangeStatus={onChangeStatus}
          onDelete={vi.fn()}
        />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: "Aceptar" }));
    expect(onChangeStatus).toHaveBeenCalledWith(deconvokedConv(), 2, null);
  });

  it("nunca muestra el botón 'Lista de espera' cuando hideWaitingListButton es verdadero, sin importar el tipo de evento", () => {
    render(
      <MemoryRouter>
        <ConvocationCard
          conv={deconvokedConv()}
          statuses={statuses}
          excuseTypes={[]}
          canEdit={true}
          canEditThisConvocation={true}
          canReactivateFromDeconvoke={true}
          hideWaitingListButton={true}
          onChangeStatus={vi.fn()}
          onDelete={vi.fn()}
          onMoveToWaiting={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.queryByRole("button", { name: /Lista de espera/i })).not.toBeInTheDocument();
  });
});
