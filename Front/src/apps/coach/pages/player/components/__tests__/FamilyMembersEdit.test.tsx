import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import FamilyMembersEdit from "../FamilyMembersEdit";
import * as teamplayerService from "../../../../services/teamplayerService";

vi.mock("../../../../services/teamplayerService", () => ({
  createFamilyMember: vi.fn(),
  deleteFamilyMember: vi.fn(),
}));

describe("FamilyMembersEdit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseMembers = [
    {
      id: "fm-1",
      name: "Ana",
      lastName: "García",
      phone: "111",
      email: "ana@test.com",
      familyMember: "Mother",
      dni: "",
    },
  ];

  it("renderiza una tarjeta con nombre y apellidos por cada familiar existente", () => {
    render(
      <FamilyMembersEdit
        teamPlayerId="tp-1"
        familyMembers={baseMembers}
        onFamilyMembersChange={vi.fn()}
      />
    );

    expect(screen.getByText("Ana García")).toBeInTheDocument();
  });

  it("no limita el número de familiares mostrados", () => {
    const many = Array.from({ length: 5 }, (_, i) => ({
      id: `fm-${i}`,
      name: `Nombre${i}`,
      lastName: `Apellido${i}`,
      phone: "",
      email: "",
      familyMember: "Other",
      dni: "",
    }));

    render(
      <FamilyMembersEdit teamPlayerId="tp-1" familyMembers={many} onFamilyMembersChange={vi.fn()} />
    );

    many.forEach((m) => {
      expect(screen.getByText(`${m.name} ${m.lastName}`)).toBeInTheDocument();
    });
  });

  it("muestra siempre el botón 'Añadir familiar', sin importar cuántos haya", () => {
    render(
      <FamilyMembersEdit teamPlayerId="tp-1" familyMembers={baseMembers} onFamilyMembersChange={vi.fn()} />
    );

    expect(screen.getByRole("button", { name: /añadir familiar/i })).toBeInTheDocument();
  });

  it("al pulsar 'Añadir familiar' abre un formulario con nombre, apellidos, parentesco, teléfono y email", async () => {
    render(
      <FamilyMembersEdit teamPlayerId="tp-1" familyMembers={[]} onFamilyMembersChange={vi.fn()} />
    );

    await userEvent.click(screen.getByRole("button", { name: /añadir familiar/i }));

    expect(screen.getByLabelText(/^nombre$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^apellidos$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/parentesco/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^teléfono$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
  });

  it("el Select de parentesco ofrece Madre, Padre, Tutor legal y Otro", async () => {
    render(
      <FamilyMembersEdit teamPlayerId="tp-1" familyMembers={[]} onFamilyMembersChange={vi.fn()} />
    );
    await userEvent.click(screen.getByRole("button", { name: /añadir familiar/i }));

    await userEvent.click(screen.getByLabelText(/parentesco/i));
    const options = await screen.findAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["Madre", "Padre", "Tutor legal", "Otro"]);
  });

  it("valida que nombre, apellidos y parentesco son obligatorios antes de guardar", async () => {
    render(
      <FamilyMembersEdit teamPlayerId="tp-1" familyMembers={[]} onFamilyMembersChange={vi.fn()} />
    );
    await userEvent.click(screen.getByRole("button", { name: /añadir familiar/i }));

    await userEvent.click(screen.getByRole("button", { name: /^guardar$/i }));

    expect(await screen.findByText(/nombre es obligatorio/i)).toBeInTheDocument();
    expect(screen.getByText(/apellidos son obligatorios/i)).toBeInTheDocument();
    expect(screen.getByText(/parentesco es obligatorio/i)).toBeInTheDocument();
    expect(teamplayerService.createFamilyMember).not.toHaveBeenCalled();
  });

  it("valida el formato del email si se informa", async () => {
    render(
      <FamilyMembersEdit teamPlayerId="tp-1" familyMembers={[]} onFamilyMembersChange={vi.fn()} />
    );
    await userEvent.click(screen.getByRole("button", { name: /añadir familiar/i }));

    await userEvent.type(screen.getByLabelText(/^nombre$/i), "Luis");
    await userEvent.type(screen.getByLabelText(/^apellidos$/i), "Pérez");
    await userEvent.click(screen.getByLabelText(/parentesco/i));
    await userEvent.click(await screen.findByRole("option", { name: "Padre" }));
    await userEvent.type(screen.getByLabelText(/^email$/i), "no-es-un-email");

    await userEvent.click(screen.getByRole("button", { name: /^guardar$/i }));

    expect(await screen.findByText(/email no tiene un formato válido/i)).toBeInTheDocument();
    expect(teamplayerService.createFamilyMember).not.toHaveBeenCalled();
  });

  it("crea el familiar y lo añade a la lista al enviar el formulario correctamente", async () => {
    const created = {
      id: "fm-new",
      name: "Luis",
      lastName: "Pérez",
      phone: "",
      email: "",
      familyMember: "Father",
      dni: "",
    };
    vi.mocked(teamplayerService.createFamilyMember).mockResolvedValueOnce(created);
    const onFamilyMembersChange = vi.fn();

    render(
      <FamilyMembersEdit
        teamPlayerId="tp-1"
        familyMembers={baseMembers}
        onFamilyMembersChange={onFamilyMembersChange}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /añadir familiar/i }));
    await userEvent.type(screen.getByLabelText(/^nombre$/i), "Luis");
    await userEvent.type(screen.getByLabelText(/^apellidos$/i), "Pérez");
    await userEvent.click(screen.getByLabelText(/parentesco/i));
    await userEvent.click(await screen.findByRole("option", { name: "Padre" }));

    await userEvent.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => {
      expect(teamplayerService.createFamilyMember).toHaveBeenCalledWith("tp-1", {
        name: "Luis",
        lastName: "Pérez",
        familyMemberId: 2,
        phone: null,
        email: null,
        dni: null,
      });
    });
    expect(onFamilyMembersChange).toHaveBeenCalledWith([...baseMembers, created]);
    // El formulario se cierra tras el éxito.
    expect(screen.queryByLabelText(/^nombre$/i)).not.toBeInTheDocument();
  });

  it("muestra un error y mantiene el formulario abierto si el servicio falla al crear", async () => {
    vi.mocked(teamplayerService.createFamilyMember).mockRejectedValueOnce({
      response: { data: { detail: "No se pudo crear el familiar" } },
    });
    const onFamilyMembersChange = vi.fn();

    render(
      <FamilyMembersEdit teamPlayerId="tp-1" familyMembers={[]} onFamilyMembersChange={onFamilyMembersChange} />
    );
    await userEvent.click(screen.getByRole("button", { name: /añadir familiar/i }));
    await userEvent.type(screen.getByLabelText(/^nombre$/i), "Luis");
    await userEvent.type(screen.getByLabelText(/^apellidos$/i), "Pérez");
    await userEvent.click(screen.getByLabelText(/parentesco/i));
    await userEvent.click(await screen.findByRole("option", { name: "Padre" }));

    await userEvent.click(screen.getByRole("button", { name: /^guardar$/i }));

    expect(await screen.findByText(/no se pudo crear el familiar/i)).toBeInTheDocument();
    expect(onFamilyMembersChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/^nombre$/i)).toBeInTheDocument();
  });

  it("cada tarjeta de familiar ya guardado ofrece un botón Eliminar", () => {
    render(
      <FamilyMembersEdit teamPlayerId="tp-1" familyMembers={baseMembers} onFamilyMembersChange={vi.fn()} />
    );

    expect(screen.getByRole("button", { name: /eliminar familiar/i })).toBeInTheDocument();
  });

  it("pulsar Eliminar abre un diálogo de confirmación y no borra hasta confirmar", async () => {
    render(
      <FamilyMembersEdit teamPlayerId="tp-1" familyMembers={baseMembers} onFamilyMembersChange={vi.fn()} />
    );

    await userEvent.click(screen.getByRole("button", { name: /eliminar familiar/i }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(teamplayerService.deleteFamilyMember).not.toHaveBeenCalled();
  });

  it("confirmar el borrado llama al servicio y quita el familiar de la lista", async () => {
    vi.mocked(teamplayerService.deleteFamilyMember).mockResolvedValueOnce(undefined);
    const onFamilyMembersChange = vi.fn();

    render(
      <FamilyMembersEdit
        teamPlayerId="tp-1"
        familyMembers={baseMembers}
        onFamilyMembersChange={onFamilyMembersChange}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: /eliminar familiar/i }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: /^eliminar$/i }));

    await waitFor(() => {
      expect(teamplayerService.deleteFamilyMember).toHaveBeenCalledWith("tp-1", "fm-1");
    });
    expect(onFamilyMembersChange).toHaveBeenCalledWith([]);
  });

  it("cancelar el diálogo de borrado no llama al servicio ni modifica la lista", async () => {
    const onFamilyMembersChange = vi.fn();

    render(
      <FamilyMembersEdit
        teamPlayerId="tp-1"
        familyMembers={baseMembers}
        onFamilyMembersChange={onFamilyMembersChange}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: /eliminar familiar/i }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: /cancelar/i }));

    expect(teamplayerService.deleteFamilyMember).not.toHaveBeenCalled();
    expect(onFamilyMembersChange).not.toHaveBeenCalled();
  });

  it("muestra un mensaje de error si el borrado falla y conserva la tarjeta", async () => {
    vi.mocked(teamplayerService.deleteFamilyMember).mockRejectedValueOnce({
      response: { data: { detail: "No se pudo eliminar" } },
    });
    const onFamilyMembersChange = vi.fn();

    render(
      <FamilyMembersEdit
        teamPlayerId="tp-1"
        familyMembers={baseMembers}
        onFamilyMembersChange={onFamilyMembersChange}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: /eliminar familiar/i }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: /^eliminar$/i }));

    expect(await screen.findByText(/no se pudo eliminar/i)).toBeInTheDocument();
    expect(onFamilyMembersChange).not.toHaveBeenCalled();
    expect(screen.getByText("Ana García")).toBeInTheDocument();
  });

  it("no renderiza ninguna tarjeta cuando no hay familiares", () => {
    render(
      <FamilyMembersEdit teamPlayerId="tp-1" familyMembers={[]} onFamilyMembersChange={vi.fn()} />
    );

    expect(screen.queryByRole("button", { name: /eliminar familiar/i })).not.toBeInTheDocument();
  });
});
