import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DeconvokeDialog from "../DeconvokeDialog";
import type { ExcuseType } from "../../../../services/excuseTypeService";

const excuseTypes: ExcuseType[] = [
  { id: 1, name: "Lesión", justified: true } as ExcuseType,
  { id: 2, name: "Enfermedad", justified: true } as ExcuseType,
];

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
