import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const resetClientState = vi.fn().mockResolvedValue(undefined);
vi.mock("../../../../../core/diagnostics/resetClientState", () => ({
  resetClientState: () => resetClientState(),
}));
vi.mock("../../../../../apps/coach/context/CoachAuthContext", () => ({
  useCoachAuthContext: () => ({ login: vi.fn(), isSubmitting: false }),
}));
vi.mock("../../BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import SharedLogin from "../Login";
import { clearAuthTrace, traceAuth } from "../../../../../core/diagnostics/authTrace";

const reload = vi.fn();

function renderLogin(url = "/login") {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <SharedLogin onReload={reload} />
    </MemoryRouter>,
  );
}

describe("Login — limpieza de sesión y diagnóstico", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAuthTrace();
  });

  it("pide confirmación antes de limpiar y no limpia si se cancela", async () => {
    renderLogin();

    await userEvent.click(screen.getByRole("button", { name: /limpiar sesión y datos/i }));
    expect(await screen.findByText(/se borrarán los datos guardados/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(resetClientState).not.toHaveBeenCalled();
  });

  it("limpia los datos y recarga la app al confirmar", async () => {
    renderLogin();

    await userEvent.click(screen.getByRole("button", { name: /limpiar sesión y datos/i }));
    await userEvent.click(await screen.findByRole("button", { name: /^limpiar$/i }));

    await waitFor(() => expect(resetClientState).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  it("limpia automáticamente cuando la URL trae reset=1", async () => {
    renderLogin("/login?reset=1");

    await waitFor(() => expect(resetClientState).toHaveBeenCalledTimes(1));
  });

  it("copia el diagnóstico al portapapeles", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    traceAuth("login.failed");
    renderLogin();

    await userEvent.click(screen.getByRole("button", { name: /copiar diagnóstico/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining("login.failed")));
  });
});
