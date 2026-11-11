import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../../core/api/client", () => ({
  registerNavigate: vi.fn(),
  client: {},
}));
vi.mock("../../BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../../ContentLayout/ContentLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import Error500 from "../Error500";

const SESSION_KEYS = [
  "coachAuthToken",
  "coachUserId",
  "coach_roles",
  "coach_player_teamId",
];

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/error-500" element={<Error500 />} />
        <Route path="/" element={<div>inicio</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function seedSession() {
  SESSION_KEYS.forEach((k) => localStorage.setItem(k, "valor"));
  localStorage.setItem("otraPreferencia", "se-conserva");
}

describe("Error500 — Volver al inicio", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it.each(["network", "timeout"])(
    "limpia los datos de sesión al volver al inicio cuando reason=%s",
    async (reason) => {
      seedSession();
      renderAt(`/error-500?reason=${reason}`);

      await userEvent.click(
        screen.getByRole("button", { name: /volver al inicio/i }),
      );

      SESSION_KEYS.forEach((k) => expect(localStorage.getItem(k)).toBeNull());
    },
  );

  it("no borra otros datos del navegador al limpiar la sesión", async () => {
    seedSession();
    renderAt("/error-500?reason=network");

    await userEvent.click(
      screen.getByRole("button", { name: /volver al inicio/i }),
    );

    expect(localStorage.getItem("otraPreferencia")).toBe("se-conserva");
  });

  it("navega al inicio tras limpiar la sesión", async () => {
    seedSession();
    renderAt("/error-500?reason=network");

    await userEvent.click(
      screen.getByRole("button", { name: /volver al inicio/i }),
    );

    expect(screen.getByText("inicio")).toBeInTheDocument();
  });

  it("conserva la sesión al volver al inicio en un 500 real (sin reason)", async () => {
    seedSession();
    renderAt("/error-500");

    await userEvent.click(
      screen.getByRole("button", { name: /volver al inicio/i }),
    );

    SESSION_KEYS.forEach((k) => expect(localStorage.getItem(k)).toBe("valor"));
  });
});
