import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserProvider } from "../../../../../shared/context/UserContext";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("../../../services/aiProviderService", () => ({
  getAiProviders: vi.fn(),
  createAiProvider: vi.fn(),
  updateAiProvider: vi.fn(),
  deleteAiProvider: vi.fn(),
  activateAiProvider: vi.fn(),
  testAiProviderConnection: vi.fn(),
}));

import {
  activateAiProvider,
  deleteAiProvider,
  getAiProviders,
  testAiProviderConnection,
  type AiProvider,
} from "../../../services/aiProviderService";
import AiSettings from "../AiSettings";

const mocked = {
  getAiProviders: vi.mocked(getAiProviders),
  activateAiProvider: vi.mocked(activateAiProvider),
  deleteAiProvider: vi.mocked(deleteAiProvider),
  testAiProviderConnection: vi.mocked(testAiProviderConnection),
};

const claude: AiProvider = {
  id: "p1",
  template: "claude",
  baseUrl: "https://api.anthropic.com",
  model: "claude-sonnet-4-5",
  maskedApiKey: "****1234",
  isActive: true,
};

const gemini: AiProvider = {
  id: "p2",
  template: "gemini",
  baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
  model: "gemini-2.0-flash",
  maskedApiKey: "****9999",
  isActive: false,
};

function renderPage() {
  return render(
    <UserProvider>
      <MemoryRouter>
        <AiSettings />
      </MemoryRouter>
    </UserProvider>
  );
}

function cardFor(name: RegExp) {
  return screen.getByRole("article", { name });
}

describe("AiSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra un indicador de carga mientras recupera los proveedores", () => {
    mocked.getAiProviders.mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("muestra el estado vacío cuando no hay proveedores", async () => {
    mocked.getAiProviders.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText(/todavía no has añadido ningún proveedor/i)).toBeInTheDocument();
  });

  it("muestra el error y permite reintentar", async () => {
    mocked.getAiProviders.mockRejectedValueOnce(new Error("boom")).mockResolvedValue([claude]);
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: /reintentar/i }));

    expect(await screen.findByText("Claude (Anthropic)")).toBeInTheDocument();
  });

  it("muestra cada proveedor como tarjeta con la clave enmascarada y marca el activo", async () => {
    mocked.getAiProviders.mockResolvedValue([claude, gemini]);
    renderPage();

    const claudeCard = within(await screen.findByRole("article", { name: /claude/i }));
    expect(claudeCard.getByText(/claude-sonnet-4-5/)).toBeInTheDocument();
    expect(claudeCard.getByText(/\*\*\*\*1234/)).toBeInTheDocument();
    expect(claudeCard.getByText("Activo")).toBeInTheDocument();
    expect(within(cardFor(/gemini/i)).queryByText("Activo")).not.toBeInTheDocument();
  });

  it("activa un proveedor y recarga el listado", async () => {
    mocked.getAiProviders.mockResolvedValue([claude, gemini]);
    mocked.activateAiProvider.mockResolvedValue(undefined);
    renderPage();
    await screen.findByRole("article", { name: /gemini/i });

    await userEvent.click(within(cardFor(/gemini/i)).getByRole("button", { name: "Activar" }));

    await waitFor(() => expect(mocked.activateAiProvider).toHaveBeenCalledWith("p2"));
    await waitFor(() => expect(mocked.getAiProviders).toHaveBeenCalledTimes(2));
  });

  it("no ofrece activar el proveedor que ya está activo", async () => {
    mocked.getAiProviders.mockResolvedValue([claude]);
    renderPage();

    const card = within(await screen.findByRole("article", { name: /claude/i }));

    expect(card.queryByRole("button", { name: "Activar" })).not.toBeInTheDocument();
  });

  it("prueba la conexión de un proveedor guardado con su clave almacenada y avisa del resultado", async () => {
    mocked.getAiProviders.mockResolvedValue([gemini]);
    mocked.testAiProviderConnection.mockResolvedValue({ success: false, failure: "QuotaExceeded", message: "Cuota superada." });
    const listener = vi.fn();
    window.addEventListener("rffm.show_snackbar", listener);
    renderPage();

    await userEvent.click(within(await screen.findByRole("article", { name: /gemini/i })).getByRole("button", { name: /probar conexión/i }));

    await waitFor(() =>
      expect(mocked.testAiProviderConnection).toHaveBeenCalledWith({
        id: "p2",
        template: "gemini",
        baseUrl: gemini.baseUrl,
        apiKey: null,
        model: gemini.model,
      })
    );
    await waitFor(() => expect(listener).toHaveBeenCalled());
    const detail = (listener.mock.calls[0][0] as CustomEvent).detail;
    expect(detail).toEqual({ message: "Cuota superada.", severity: "error" });
    window.removeEventListener("rffm.show_snackbar", listener);
  });

  it("no elimina nada si se cancela la confirmación", async () => {
    mocked.getAiProviders.mockResolvedValue([claude]);
    renderPage();

    await userEvent.click(within(await screen.findByRole("article", { name: /claude/i })).getByRole("button", { name: "Eliminar" }));
    await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(mocked.deleteAiProvider).not.toHaveBeenCalled();
  });

  it("elimina el proveedor tras confirmar y recarga el listado", async () => {
    mocked.getAiProviders.mockResolvedValueOnce([claude]).mockResolvedValue([]);
    mocked.deleteAiProvider.mockResolvedValue(undefined);
    renderPage();

    await userEvent.click(within(await screen.findByRole("article", { name: /claude/i })).getByRole("button", { name: "Eliminar" }));
    const dialog = within(await screen.findByRole("dialog"));
    await userEvent.click(dialog.getByRole("button", { name: "Eliminar" }));

    await waitFor(() => expect(mocked.deleteAiProvider).toHaveBeenCalledWith("p1"));
    expect(await screen.findByText(/todavía no has añadido ningún proveedor/i)).toBeInTheDocument();
  });

  it("abre el formulario vacío al pulsar Añadir proveedor", async () => {
    mocked.getAiProviders.mockResolvedValue([]);
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: /añadir proveedor/i }));

    expect(await screen.findByRole("dialog", { name: /añadir proveedor de ia/i })).toBeInTheDocument();
  });

  it("abre el formulario con los datos del proveedor al pulsar Editar", async () => {
    mocked.getAiProviders.mockResolvedValue([claude]);
    renderPage();

    await userEvent.click(within(await screen.findByRole("article", { name: /claude/i })).getByRole("button", { name: "Editar" }));

    const dialog = within(await screen.findByRole("dialog", { name: /editar proveedor de ia/i }));
    expect(dialog.getByLabelText(/modelo/i)).toHaveValue("claude-sonnet-4-5");
  });

  it("vuelve a la pantalla anterior al pulsar Volver", async () => {
    mocked.getAiProviders.mockResolvedValue([]);
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: /volver/i }));

    expect(navigateMock).toHaveBeenCalledWith(-1);
  });
});
