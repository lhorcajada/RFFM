import React from "react";
import { render, screen, within } from "@testing-library/react";
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

describe("ConvocationCard - edición del motivo de desconvocatoria", () => {
  it("muestra el botón 'Editar motivo' para una convocatoria desconvocada cuando canEditThisConvocation es verdadero", () => {
    render(
      <MemoryRouter>
        <ConvocationCard
          conv={deconvokedConv()}
          statuses={statuses}
          excuseTypes={[]}
          canEdit={true}
          canEditThisConvocation={true}
          onChangeStatus={vi.fn()}
          onDelete={vi.fn()}
          onEditReason={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole("button", { name: /Editar motivo/i })).toBeInTheDocument();
  });

  it("no muestra el botón 'Editar motivo' cuando canEditThisConvocation es falso", () => {
    render(
      <MemoryRouter>
        <ConvocationCard
          conv={deconvokedConv()}
          statuses={statuses}
          excuseTypes={[]}
          canEdit={true}
          canEditThisConvocation={false}
          onChangeStatus={vi.fn()}
          onDelete={vi.fn()}
          onEditReason={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.queryByRole("button", { name: /Editar motivo/i })).not.toBeInTheDocument();
  });

  it("no muestra el botón 'Editar motivo' cuando no se proporciona onEditReason", () => {
    render(
      <MemoryRouter>
        <ConvocationCard
          conv={deconvokedConv()}
          statuses={statuses}
          excuseTypes={[]}
          canEdit={true}
          canEditThisConvocation={true}
          onChangeStatus={vi.fn()}
          onDelete={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.queryByRole("button", { name: /Editar motivo/i })).not.toBeInTheDocument();
  });

  it("llama a onEditReason con la convocatoria al pulsar 'Editar motivo'", async () => {
    const onEditReason = vi.fn();
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ConvocationCard
          conv={deconvokedConv({ excuseTypeId: 5 })}
          statuses={statuses}
          excuseTypes={[{ id: 5, name: "Lesión" }]}
          canEdit={true}
          canEditThisConvocation={true}
          onChangeStatus={vi.fn()}
          onDelete={vi.fn()}
          onEditReason={onEditReason}
        />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /Editar motivo/i }));
    expect(onEditReason).toHaveBeenCalledWith(deconvokedConv({ excuseTypeId: 5 }));
  });
});

describe("ConvocationCard - menú de acciones de un aceptado", () => {
  it("agrupa 'Desconvocar' y 'Lista de espera' en el menú «⋮» del entrenador", async () => {
    const onDelete = vi.fn();
    const onMoveToWaiting = vi.fn();
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ConvocationCard
          conv={baseConv({ status: 2 })}
          statuses={statuses}
          excuseTypes={[]}
          canEdit={true}
          onChangeStatus={vi.fn()}
          onDelete={onDelete}
          onMoveToWaiting={onMoveToWaiting}
        />
      </MemoryRouter>
    );

    expect(screen.queryByRole("button", { name: "Desconvocar" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Acciones de Jugador de prueba" }));

    expect(screen.getByRole("menuitem", { name: "↩ Lista de espera" })).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Desconvocar" }));
    expect(onDelete).toHaveBeenCalledWith(baseConv({ status: 2 }));
  });

  it("no muestra el menú de acciones si no se puede editar", () => {
    render(
      <MemoryRouter>
        <ConvocationCard
          conv={baseConv({ status: 2 })}
          statuses={statuses}
          excuseTypes={[]}
          canEdit={false}
          onChangeStatus={vi.fn()}
          onDelete={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.queryByRole("button", { name: /Acciones de/ })).not.toBeInTheDocument();
  });

  it("muestra el chip «Va» en un aceptado", () => {
    render(
      <MemoryRouter>
        <ConvocationCard
          conv={baseConv({ status: 2 })}
          statuses={statuses}
          excuseTypes={[]}
          canEdit={false}
          onChangeStatus={vi.fn()}
          onDelete={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Va")).toBeInTheDocument();
  });
});

describe("ConvocationCard - variante «Tu jugador»", () => {
  it("pinta la convocatoria pendiente propia en «Tu jugador» con 'Aceptar' y 'Rechazar'", async () => {
    const onChangeStatus = vi.fn();
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ConvocationCard
          variant="own"
          conv={baseConv()}
          statuses={statuses}
          excuseTypes={[]}
          canEdit={true}
          onChangeStatus={onChangeStatus}
          onDelete={vi.fn()}
        />
      </MemoryRouter>
    );

    const section = screen.getByRole("region", { name: "Tu jugador" });
    expect(within(section).getByText("Pendiente")).toBeInTheDocument();
    expect(within(section).getByRole("button", { name: "Rechazar" })).toBeInTheDocument();
    await user.click(within(section).getByRole("button", { name: "Aceptar" }));
    expect(onChangeStatus).toHaveBeenCalledWith(baseConv(), 2, null);
  });

  it("muestra 'Desconvocar' directamente (sin menú) en la convocatoria aceptada propia", () => {
    render(
      <MemoryRouter>
        <ConvocationCard
          variant="own"
          conv={baseConv({ status: 2 })}
          statuses={statuses}
          excuseTypes={[]}
          canEdit={true}
          onChangeStatus={vi.fn()}
          onDelete={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole("button", { name: "Desconvocar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Acciones de/ })).not.toBeInTheDocument();
  });

  it("muestra el motivo de la desconvocatoria propia", () => {
    render(
      <MemoryRouter>
        <ConvocationCard
          variant="own"
          conv={deconvokedConv({ excuseTypeId: 5 })}
          statuses={statuses}
          excuseTypes={[{ id: 5, name: "Enfermedad" }]}
          canEdit={true}
          onChangeStatus={vi.fn()}
          onDelete={vi.fn()}
        />
      </MemoryRouter>
    );

    const section = screen.getByRole("region", { name: "Tu jugador" });
    expect(within(section).getByText("No va")).toBeInTheDocument();
    expect(within(section).getByText("Enfermedad")).toBeInTheDocument();
  });
});
