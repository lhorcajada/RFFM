import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AttendanceCard from "../AttendanceCard";
import type { ConvocationItem } from "../../../../services/convocationService";

const assistanceTypes = [
  { id: 1, name: "Asiste" },
  { id: 2, name: "No asiste con excusa" },
  { id: 3, name: "No asiste sin excusa" },
  { id: 4, name: "Llega tarde" },
];
const excuseTypes = [
  { id: 10, name: "Enfermedad" },
  { id: 11, name: "Estudios" },
];

function buildConv(overrides: Partial<ConvocationItem> = {}): ConvocationItem {
  return {
    id: "conv-1",
    player: { id: "p1", playerId: "p1", alias: "Hugo M.", position: "Portero" },
    status: 2,
    assistanceTypeId: null,
    excuseTypeId: null,
    isInjured: false,
    ...overrides,
  } as ConvocationItem;
}

const onChange = vi.fn();

function renderCard(conv: ConvocationItem, canEdit = true) {
  return render(
    <MemoryRouter>
      <ul>
        <AttendanceCard
          conv={conv}
          photoSrc={null}
          assistanceTypes={assistanceTypes}
          excuseTypes={excuseTypes}
          canEdit={canEdit}
          onChange={onChange}
        />
      </ul>
    </MemoryRouter>
  );
}

describe("AttendanceCard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("muestra el nombre del jugador y el chip 'Sin indicar' cuando no hay asistencia", () => {
    renderCard(buildConv());
    expect(screen.getByText("Hugo M.")).toBeInTheDocument();
    expect(screen.getByText("Sin indicar")).toBeInTheDocument();
  });

  it("muestra el chip con el nombre del tipo de asistencia", () => {
    renderCard(buildConv({ assistanceTypeId: 4 }));
    expect(screen.getByText("Llega tarde")).toBeInTheDocument();
  });

  it("el botón de asiste se marca como pulsado cuando asiste", () => {
    renderCard(buildConv({ assistanceTypeId: 1 }));
    expect(screen.getByRole("button", { name: /marcar que asiste/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /marcar que no asiste/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("el botón de asiste también se marca cuando llega tarde", () => {
    renderCard(buildConv({ assistanceTypeId: 4 }));
    expect(screen.getByRole("button", { name: /marcar que asiste/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("muestra el motivo de la excusa como texto secundario", () => {
    renderCard(buildConv({ assistanceTypeId: 2, excuseTypeId: 10 }));
    expect(screen.getByText("Enfermedad")).toBeInTheDocument();
  });

  it("pulsar el botón de asiste notifica el tipo 1", async () => {
    renderCard(buildConv());
    await userEvent.click(screen.getByRole("button", { name: /marcar que asiste/i }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ id: "conv-1" }), 1, null);
  });

  it("pulsar el botón de no asiste notifica el tipo 3", async () => {
    renderCard(buildConv());
    await userEvent.click(screen.getByRole("button", { name: /marcar que no asiste/i }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ id: "conv-1" }), 3, null);
  });

  it("el menú permite elegir 'Llega tarde'", async () => {
    renderCard(buildConv());
    await userEvent.click(screen.getByRole("button", { name: /más opciones de asistencia/i }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Llega tarde" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ id: "conv-1" }), 4, null);
  });

  it("el menú permite volver a 'Sin indicar'", async () => {
    renderCard(buildConv({ assistanceTypeId: 1 }));
    await userEvent.click(screen.getByRole("button", { name: /más opciones de asistencia/i }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Sin indicar" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ id: "conv-1" }), null, null);
  });

  it("con 'No asiste con excusa' el menú ofrece los motivos", async () => {
    renderCard(buildConv({ assistanceTypeId: 2 }));
    await userEvent.click(screen.getByRole("button", { name: /más opciones de asistencia/i }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Estudios" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ id: "conv-1" }), 2, 11);
  });

  it("sin motivos de excusa visibles si el tipo no es 'con excusa'", async () => {
    renderCard(buildConv({ assistanceTypeId: 1 }));
    await userEvent.click(screen.getByRole("button", { name: /más opciones de asistencia/i }));
    await screen.findByRole("menuitem", { name: "Sin indicar" });
    expect(screen.queryByRole("menuitem", { name: "Estudios" })).not.toBeInTheDocument();
  });

  it("deshabilita las acciones cuando no se puede editar", () => {
    renderCard(buildConv(), false);
    expect(screen.getByRole("button", { name: /marcar que asiste/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /marcar que no asiste/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /más opciones de asistencia/i })).toBeDisabled();
  });
});
