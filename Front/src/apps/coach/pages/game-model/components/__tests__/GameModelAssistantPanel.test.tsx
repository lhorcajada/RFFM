import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import GameModelAssistantPanel from "../GameModelAssistantPanel";
import type { AssistantMessage } from "../../../../services/gameModelService";
import type { TrackedChange } from "../gameModelProposalTree";

function renderPanel(
  overrides: Partial<{
    open: boolean;
    changes: TrackedChange[];
    onAccept: (changeId: string) => void;
    onReject: (changeId: string) => void;
    messages: AssistantMessage[];
    sending: boolean;
    error: string;
    onClose: () => void;
    onSend: (text: string) => void;
    onRetry: () => void;
    unsavedAcceptedCount: number;
  }> = {}
) {
  const props = {
    open: true,
    messages: [] as AssistantMessage[],
    sending: false,
    onClose: vi.fn(),
    onSend: vi.fn(),
    onRetry: vi.fn(),
    onAccept: vi.fn(),
    onReject: vi.fn(),
    ...overrides,
  };
  const user = userEvent.setup();
  render(<GameModelAssistantPanel {...props} />);
  return { user, props };
}

describe("GameModelAssistantPanel", () => {
  it("al abrir muestra el aviso de los datos enviados al proveedor y que no se envían datos personales identificativos", () => {
    renderPanel();

    expect(document.body).toHaveTextContent(/modelo de juego/i);
    expect(document.body).toHaveTextContent(/objetivos/i);
    expect(document.body).toHaveTextContent(/sesiones/i);
    expect(document.body).toHaveTextContent(/previsiones/i);
    expect(document.body).toHaveTextContent(/alias/i);
    expect(document.body).toHaveTextContent(/lesiones/i);
    expect(document.body).toHaveTextContent(/condición física/i);
    expect(screen.getByText(/no se envían datos personales identificativos/i)).toBeInTheDocument();
  });

  it("al escribir un mensaje y enviarlo llama a onSend con el texto", async () => {
    const { user, props } = renderPanel();

    await user.type(screen.getByRole("textbox"), "Revisa la presión");
    await user.click(screen.getByRole("button", { name: /enviar/i }));

    expect(props.onSend).toHaveBeenCalledWith("Revisa la presión");
  });

  it("con cambios aceptados sin guardar avisa de que hay que guardarlos y no deja enviar", async () => {
    const { user, props } = renderPanel({ unsavedAcceptedCount: 2 });

    expect(screen.getByRole("status")).toHaveTextContent(/guarda los cambios aceptados/i);
    await user.type(screen.getByRole("textbox"), "Otra propuesta");
    expect(screen.getByRole("button", { name: /enviar/i })).toBeDisabled();
    expect(props.onSend).not.toHaveBeenCalled();
  });

  it("sin cambios aceptados sin guardar no muestra el aviso de guardar", () => {
    renderPanel({ unsavedAcceptedCount: 0 });

    expect(screen.queryByText(/guarda los cambios aceptados/i)).not.toBeInTheDocument();
  });

  it("una respuesta de pregunta se muestra en la conversación", () => {
    renderPanel({
      messages: [
        { role: "user", content: "Hola" },
        { role: "assistant", content: "¿Qué zona quieres revisar?", kind: "question" },
      ],
    });

    expect(screen.getByText("¿Qué zona quieres revisar?")).toBeInTheDocument();
    expect(screen.getByText("Hola")).toBeInTheDocument();
  });

  it("un error muestra una alerta con el botón Reintentar, que llama a onRetry", async () => {
    const { user, props } = renderPanel({ error: "No se pudo consultar al asistente." });

    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo consultar al asistente.");
    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(props.onRetry).toHaveBeenCalledTimes(1);
  });

  const addSub: TrackedChange = {
    id: "c1",
    operation: "add",
    nodeType: "subprincipio",
    parentAddress: "moment-1/1",
    fields: { titulo: "Presión alta", texto: "Presionar tras pérdida" },
    status: "pending",
  };
  const removeSkill: TrackedChange = {
    id: "c2",
    operation: "remove",
    nodeType: "habilidad",
    address: "moment-1/1/hab:7",
    fields: {},
    status: "pending",
  };

  it("una propuesta se muestra como tarjetas con la operación, el tipo de nodo y el texto propuesto", () => {
    renderPanel({ changes: [addSub, removeSkill] });

    expect(screen.getByText(/añadir subprincipio/i)).toBeInTheDocument();
    expect(screen.getByText(/presión alta/i)).toBeInTheDocument();
    expect(screen.getByText(/presionar tras pérdida/i)).toBeInTheDocument();
    expect(screen.getByText(/eliminar habilidad/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Aceptar" })).toHaveLength(2);
  });

  it("Aceptar y Rechazar llaman a los callbacks con el id del cambio de su tarjeta", async () => {
    const { user, props } = renderPanel({ changes: [addSub] });

    await user.click(screen.getByRole("button", { name: "Aceptar" }));
    await user.click(screen.getByRole("button", { name: "Rechazar" }));

    expect(props.onAccept).toHaveBeenCalledWith("c1");
    expect(props.onReject).toHaveBeenCalledWith("c1");
  });

  it("un cambio aceptado se marca como aceptado y ya no ofrece botones; uno rechazado desaparece", () => {
    renderPanel({
      changes: [
        { ...addSub, status: "accepted" },
        { ...removeSkill, status: "rejected" },
      ],
    });

    expect(screen.getByText("Aceptado")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aceptar" })).not.toBeInTheDocument();
    expect(screen.queryByText(/eliminar habilidad/i)).not.toBeInTheDocument();
  });

  it("un cambio que depende de otro aún no aceptado tiene Aceptar deshabilitado", () => {
    const child: TrackedChange = { ...addSub, id: "c3", parentAddress: undefined, parentChangeId: "c1" };
    renderPanel({ changes: [addSub, child] });

    const [first, second] = screen.getAllByRole("button", { name: "Aceptar" });
    expect(first).toBeEnabled();
    expect(second).toBeDisabled();
  });

  it("el botón de cerrar llama a onClose", async () => {
    const { user, props } = renderPanel();

    await user.click(screen.getByRole("button", { name: /cerrar/i }));

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
