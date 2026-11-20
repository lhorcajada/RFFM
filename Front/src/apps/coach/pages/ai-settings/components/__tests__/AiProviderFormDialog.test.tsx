import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../services/aiProviderService", () => ({
  createAiProvider: vi.fn(),
  updateAiProvider: vi.fn(),
  testAiProviderConnection: vi.fn(),
  listAiProviderModels: vi.fn(),
}));

import {
  createAiProvider,
  listAiProviderModels,
  testAiProviderConnection,
  updateAiProvider,
  type AiProvider,
} from "../../../../services/aiProviderService";
import AiProviderFormDialog from "../AiProviderFormDialog";

const mocked = {
  create: vi.mocked(createAiProvider),
  update: vi.mocked(updateAiProvider),
  test: vi.mocked(testAiProviderConnection),
  listModels: vi.mocked(listAiProviderModels),
};

const existing: AiProvider = {
  id: "p1",
  template: "openai",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
  maskedApiKey: "****5678",
  isActive: false,
};

function renderDialog(provider: AiProvider | null = null) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(<AiProviderFormDialog open provider={provider} onClose={onClose} onSaved={onSaved} />);
  return { onClose, onSaved };
}

async function chooseTemplate(label: RegExp) {
  await userEvent.click(screen.getByRole("combobox", { name: /proveedor/i }));
  await userEvent.click(await screen.findByRole("option", { name: label }));
}

describe("AiProviderFormDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("al elegir la plantilla Gemini rellena la URL base y el modelo", async () => {
    renderDialog();

    await chooseTemplate(/gemini/i);

    expect(screen.getByLabelText(/url base/i)).toHaveValue("https://generativelanguage.googleapis.com/v1beta/openai");
    expect(screen.getByLabelText(/modelo/i)).toHaveValue("gemini-2.5-flash");
  });

  it("carga los modelos del proveedor con la clave escrita y permite elegir uno", async () => {
    mocked.listModels.mockResolvedValue({
      success: true,
      failure: null,
      message: "",
      models: ["gemini-2.0-flash-lite", "gemini-2.5-flash"],
    });
    renderDialog();
    await chooseTemplate(/gemini/i);
    await userEvent.type(screen.getByLabelText(/clave de api/i), "AIza-1234567890");

    await userEvent.click(screen.getByRole("button", { name: /ver modelos disponibles/i }));
    await userEvent.click(await screen.findByRole("combobox", { name: /modelo/i }));
    await userEvent.click(await screen.findByRole("option", { name: "gemini-2.0-flash-lite" }));

    expect(mocked.listModels).toHaveBeenCalledWith({
      id: null,
      template: "gemini",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKey: "AIza-1234567890",
    });
    expect(screen.getByLabelText(/modelo/i)).toHaveValue("gemini-2.0-flash-lite");
  });

  it("muestra el fallo del proveedor al cargar los modelos y deja escribir el modelo a mano", async () => {
    mocked.listModels.mockResolvedValue({ success: false, failure: "InvalidKey", message: "La clave de API no es válida.", models: [] });
    renderDialog(existing);

    await userEvent.click(screen.getByRole("button", { name: /ver modelos disponibles/i }));

    expect(await screen.findByText("La clave de API no es válida.")).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText(/modelo/i));
    await userEvent.type(screen.getByLabelText(/modelo/i), "mi-modelo");
    expect(screen.getByLabelText(/modelo/i)).toHaveValue("mi-modelo");
  });

  it("al ver los modelos de un proveedor guardado sin clave nueva envía su id", async () => {
    mocked.listModels.mockResolvedValue({ success: true, failure: null, message: "", models: ["gpt-4o"] });
    renderDialog(existing);

    await userEvent.click(screen.getByRole("button", { name: /ver modelos disponibles/i }));

    await waitFor(() => expect(mocked.listModels).toHaveBeenCalledWith(expect.objectContaining({ id: "p1", apiKey: null })));
  });

  it("no pide los modelos si falta la clave en un proveedor nuevo", async () => {
    renderDialog();
    await chooseTemplate(/gemini/i);

    await userEvent.click(screen.getByRole("button", { name: /ver modelos disponibles/i }));

    expect(mocked.listModels).not.toHaveBeenCalled();
    expect(screen.getByText("La clave de API es obligatoria.")).toBeInTheDocument();
  });

  it("la plantilla personalizada conserva lo que ya estaba escrito", async () => {
    renderDialog();
    await chooseTemplate(/openai$/i);

    await chooseTemplate(/otro/i);

    expect(screen.getByLabelText(/url base/i)).toHaveValue("https://api.openai.com/v1");
  });

  it("no guarda y nombra cada campo obligatorio que falta", async () => {
    renderDialog();

    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(screen.getByText("La plantilla o el tipo de proveedor es obligatorio.")).toBeInTheDocument();
    expect(screen.getByText("La URL base es obligatoria.")).toBeInTheDocument();
    expect(screen.getByText("La clave de API es obligatoria.")).toBeInTheDocument();
    expect(screen.getByText("El modelo es obligatorio.")).toBeInTheDocument();
    expect(mocked.create).not.toHaveBeenCalled();
  });

  it("rechaza una URL base que no es https", async () => {
    renderDialog();
    await chooseTemplate(/otro/i);
    await userEvent.type(screen.getByLabelText(/url base/i), "http://example.com/v1");
    await userEvent.type(screen.getByLabelText(/clave de api/i), "sk-1234567890");
    await userEvent.type(screen.getByLabelText(/modelo/i), "m");

    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(screen.getByText("La URL base debe ser una dirección https válida.")).toBeInTheDocument();
    expect(mocked.create).not.toHaveBeenCalled();
  });

  it("crea el proveedor con los datos del formulario", async () => {
    mocked.create.mockResolvedValue({ ...existing, id: "new" });
    const { onSaved } = renderDialog();
    await chooseTemplate(/openai$/i);
    await userEvent.type(screen.getByLabelText(/clave de api/i), "  sk-1234567890  ");

    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(mocked.create).toHaveBeenCalledWith({
        template: "openai",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-1234567890",
        model: "gpt-4o-mini",
      })
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it("al editar sin escribir una clave nueva no envía clave y muestra la guardada enmascarada", async () => {
    mocked.update.mockResolvedValue(existing);
    renderDialog(existing);

    expect(screen.getByText(/clave guardada: \*\*\*\*5678/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(mocked.update).toHaveBeenCalledWith("p1", {
        template: "openai",
        baseUrl: "https://api.openai.com/v1",
        apiKey: null,
        model: "gpt-4o-mini",
      })
    );
  });

  it("al editar nunca rellena el campo de la clave con la clave guardada", () => {
    renderDialog(existing);

    expect(screen.getByLabelText(/clave de api/i)).toHaveValue("");
  });

  it("prueba la conexión con los datos del formulario sin guardar nada", async () => {
    mocked.test.mockResolvedValue({ success: true, failure: null, message: "Conexión correcta." });
    renderDialog();
    await chooseTemplate(/claude/i);
    await userEvent.type(screen.getByLabelText(/clave de api/i), "sk-ant-1234567890");

    await userEvent.click(screen.getByRole("button", { name: /probar conexión/i }));

    expect(await screen.findByText("Conexión correcta.")).toBeInTheDocument();
    expect(mocked.test).toHaveBeenCalledWith({
      id: null,
      template: "claude",
      baseUrl: "https://api.anthropic.com",
      apiKey: "sk-ant-1234567890",
      model: "claude-sonnet-4-5",
    });
    expect(mocked.create).not.toHaveBeenCalled();
    expect(mocked.update).not.toHaveBeenCalled();
  });

  it("al probar un proveedor guardado sin clave nueva envía su id", async () => {
    mocked.test.mockResolvedValue({ success: true, failure: null, message: "Conexión correcta." });
    renderDialog(existing);

    await userEvent.click(screen.getByRole("button", { name: /probar conexión/i }));

    await waitFor(() =>
      expect(mocked.test).toHaveBeenCalledWith(expect.objectContaining({ id: "p1", apiKey: null }))
    );
  });

  it("muestra el fallo clasificado de la prueba de conexión", async () => {
    mocked.test.mockResolvedValue({ success: false, failure: "InvalidKey", message: "La clave de API no es válida." });
    renderDialog(existing);

    await userEvent.click(screen.getByRole("button", { name: /probar conexión/i }));

    expect(await screen.findByText("La clave de API no es válida.")).toBeInTheDocument();
  });

  it("no prueba la conexión si faltan campos", async () => {
    renderDialog();

    await userEvent.click(screen.getByRole("button", { name: /probar conexión/i }));

    expect(mocked.test).not.toHaveBeenCalled();
    expect(screen.getByText("El modelo es obligatorio.")).toBeInTheDocument();
  });
});
