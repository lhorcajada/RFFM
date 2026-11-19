import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import GameModelAssistantPanel from "../GameModelAssistantPanel";
import type { AssistantMessage } from "../../../../services/gameModelService";

function renderPanel(
  overrides: Partial<{
    open: boolean;
    messages: AssistantMessage[];
    sending: boolean;
    error: string;
    onClose: () => void;
    onSend: (text: string) => void;
    onRetry: () => void;
  }> = {}
) {
  const props = {
    open: true,
    messages: [] as AssistantMessage[],
    sending: false,
    onClose: vi.fn(),
    onSend: vi.fn(),
    onRetry: vi.fn(),
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

  it("el botón de cerrar llama a onClose", async () => {
    const { user, props } = renderPanel();

    await user.click(screen.getByRole("button", { name: /cerrar/i }));

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
