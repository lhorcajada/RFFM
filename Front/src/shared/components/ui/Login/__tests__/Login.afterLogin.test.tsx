import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const login = vi.fn();
vi.mock("../../../../../apps/coach/context/CoachAuthContext", () => ({
  useCoachAuthContext: () => ({ login, isSubmitting: false }),
}));
vi.mock("../../BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import SharedLogin from "../Login";

const hardRedirect = vi.fn();

function setPathname(pathname: string) {
  window.history.pushState({}, "", pathname);
}

async function submitLogin() {
  render(
    <MemoryRouter initialEntries={["/login"]}>
      <SharedLogin onHardRedirect={hardRedirect} />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText(/usuario/i), { target: { value: "coach" } });
  fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: "secreta" } });
  await act(async () => {
    fireEvent.submit(screen.getByRole("button", { name: /iniciar sesión/i }).closest("form")!);
  });
}

describe("Login — navegación tras iniciar sesión", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    hardRedirect.mockClear();
    login.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    setPathname("/");
  });

  it("no fuerza una recarga completa si la app ya ha pasado a otra pantalla (la selección de app redirige)", async () => {
    setPathname("/team/abc");
    await submitLogin();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(hardRedirect).not.toHaveBeenCalled();
  });

  it("no fuerza una recarga completa si ya está en la pantalla destino", async () => {
    setPathname("/appSelector");
    await submitLogin();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(hardRedirect).not.toHaveBeenCalled();
  });

  it("solo fuerza la recarga si la navegación no ha salido de /login", async () => {
    setPathname("/login");
    await submitLogin();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(hardRedirect).toHaveBeenCalledWith("/appSelector");
  });
});
