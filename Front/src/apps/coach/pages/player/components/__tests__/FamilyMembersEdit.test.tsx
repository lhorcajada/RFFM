import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import FamilyMembersEdit from "../FamilyMembersEdit";

describe("FamilyMembersEdit", () => {
  it("renderiza un bloque de campos por cada familiar existente", () => {
    const form = {
      familyMembers: [
        { name: "Ana", phone: "111", email: "ana@test.com", familyMemberId: 1 },
        { name: "Luis", phone: "222", email: "luis@test.com", familyMemberId: 2 },
      ],
    };

    render(<FamilyMembersEdit form={form} setForm={vi.fn()} />);

    expect(screen.getByDisplayValue("Ana")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Luis")).toBeInTheDocument();
    expect(screen.getByDisplayValue("ana@test.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("luis@test.com")).toBeInTheDocument();
  });

  it("no ofrece botón de eliminar familiares ya guardados", () => {
    const form = {
      familyMembers: [{ name: "Ana", phone: "111", email: "ana@test.com", familyMemberId: 1 }],
    };

    render(<FamilyMembersEdit form={form} setForm={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /eliminar/i })).not.toBeInTheDocument();
  });

  it("muestra el botón 'Añadir familiar' cuando hay menos de 2 familiares", () => {
    const form = {
      familyMembers: [{ name: "Ana", phone: "111", email: "ana@test.com", familyMemberId: 1 }],
    };

    render(<FamilyMembersEdit form={form} setForm={vi.fn()} />);

    expect(screen.getByRole("button", { name: /añadir familiar/i })).toBeInTheDocument();
  });

  it("oculta el botón 'Añadir familiar' cuando ya hay 2 familiares", () => {
    const form = {
      familyMembers: [
        { name: "Ana", phone: "111", email: "ana@test.com", familyMemberId: 1 },
        { name: "Luis", phone: "222", email: "luis@test.com", familyMemberId: 2 },
      ],
    };

    render(<FamilyMembersEdit form={form} setForm={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /añadir familiar/i })).not.toBeInTheDocument();
  });

  it("al pulsar 'Añadir familiar' añade una fila en blanco mediante setForm", async () => {
    const form = { familyMembers: [] };
    const setForm = vi.fn();

    render(<FamilyMembersEdit form={form} setForm={setForm} />);

    await userEvent.click(screen.getByRole("button", { name: /añadir familiar/i }));

    expect(setForm).toHaveBeenCalledWith({
      familyMembers: [{ name: "", phone: "", email: "", familyMemberId: null, familyMember: null, dni: "" }],
    });
  });

  it("renderiza el campo DNI de cada familiar", () => {
    const form = {
      familyMembers: [{ name: "Ana", phone: "111", email: "ana@test.com", familyMemberId: 1, dni: "52378762B" }],
    };

    render(<FamilyMembersEdit form={form} setForm={vi.fn()} />);

    expect(screen.getByDisplayValue("52378762B")).toBeInTheDocument();
    expect(screen.getByLabelText(/^dni$/i)).toBeInTheDocument();
  });

  it("el Select de parentesco solo ofrece Madre y Padre", async () => {
    const form = {
      familyMembers: [{ name: "Ana", phone: "111", email: "ana@test.com", familyMemberId: 1 }],
    };

    render(<FamilyMembersEdit form={form} setForm={vi.fn()} />);

    const select = screen.getByLabelText(/parentesco/i);
    await userEvent.click(select);

    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options.map((o) => o.textContent)).toEqual(["Madre", "Padre"]);
  });

  it("actualiza el nombre del familiar mediante setForm", async () => {
    const form = {
      familyMembers: [{ name: "Ana", phone: "111", email: "ana@test.com", familyMemberId: 1 }],
    };
    const setForm = vi.fn();

    render(<FamilyMembersEdit form={form} setForm={setForm} />);

    const nameInput = screen.getByDisplayValue("Ana");
    await userEvent.type(nameInput, "!");

    expect(setForm).toHaveBeenCalled();
  });

  it("no renderiza campos de formulario cuando no hay familiares", () => {
    render(<FamilyMembersEdit form={{ familyMembers: [] }} setForm={vi.fn()} />);

    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });
});
