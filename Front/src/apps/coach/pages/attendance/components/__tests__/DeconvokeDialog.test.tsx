import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DeconvokeDialog from "../DeconvokeDialog";
import type { ExcuseType } from "../../../../services/excuseTypeService";

const excuseTypes: ExcuseType[] = [
  { id: 1, name: "Lesión", justified: true } as ExcuseType,
  { id: 2, name: "Enfermedad", justified: true } as ExcuseType,
];

const allExcuseTypes: ExcuseType[] = [
  ...excuseTypes,
  { id: 7, name: "Decisión técnica", justified: false } as ExcuseType,
  { id: 8, name: "Sanción deportiva", justified: true } as ExcuseType,
  { id: 9, name: "Cita médica", justified: true } as ExcuseType,
];

describe("DeconvokeDialog - motivos reservados al entrenador", () => {
  it("oculta 'Decisión técnica' y 'Sanción deportiva' a jugador o familiar", () => {
    render(
      <DeconvokeDialog
        open={true}
        onClose={vi.fn()}
        excuseTypes={allExcuseTypes}
        onConfirm={vi.fn()}
        hideCoachOnly
      />
    );

    expect(screen.queryByRole("button", { name: /Decisión técnica/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sanción deportiva/i })).not.toBeInTheDocument();
  });

  it("muestra 'Cita médica' a jugador o familiar", () => {
    render(
      <DeconvokeDialog
        open={true}
        onClose={vi.fn()}
        excuseTypes={allExcuseTypes}
        onConfirm={vi.fn()}
        hideCoachOnly
      />
    );

    expect(screen.getByRole("button", { name: /Cita médica/i })).toBeInTheDocument();
  });

  it("muestra 'Decisión técnica' y 'Sanción deportiva' al entrenador", () => {
    render(
      <DeconvokeDialog
        open={true}
        onClose={vi.fn()}
        excuseTypes={allExcuseTypes}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /Decisión técnica/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sanción deportiva/i })).toBeInTheDocument();
  });
});

describe("DeconvokeDialog - preselección de motivo al editar", () => {
  it("preselecciona la opción correspondiente a initialValue al abrir", () => {
    render(
      <DeconvokeDialog
        open={true}
        onClose={vi.fn()}
        excuseTypes={excuseTypes}
        onConfirm={vi.fn()}
        initialValue="1"
      />
    );

    expect(screen.getByRole("button", { name: /Lesión/i }).className).toMatch(
      /dialogOptionBtnActive/
    );
  });

  it("preselecciona 'Decisión técnica' cuando initialValue es 'technical'", () => {
    render(
      <DeconvokeDialog
        open={true}
        onClose={vi.fn()}
        excuseTypes={excuseTypes}
        onConfirm={vi.fn()}
        initialValue="technical"
      />
    );

    expect(
      screen.getByRole("button", { name: /Decisión técnica/i }).className
    ).toMatch(/dialogOptionBtnActive/);
  });
});
