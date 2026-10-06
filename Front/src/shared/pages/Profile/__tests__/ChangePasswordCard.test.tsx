import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../services/profile/profileService", () => ({
  changePassword: vi.fn(),
}));
vi.mock("../../../utils/errorMessages", () => ({
  mapApiErrorToMessage: (error: { response?: { data?: { code?: string } } }) =>
    error?.response?.data?.code === "CurrentPasswordIncorrect"
      ? "La contraseña actual no es correcta."
      : "Error",
}));

import ChangePasswordCard from "../components/ChangePasswordCard";
import { changePassword } from "../../../services/profile/profileService";

async function fill(current: string, next: string, repeat: string) {
  await userEvent.type(screen.getByLabelText(/contraseña actual/i), current);
  await userEvent.type(screen.getByLabelText(/^nueva contraseña/i), next);
  await userEvent.type(screen.getByLabelText(/repetir/i), repeat);
}

describe("ChangePasswordCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("avisa si las contraseñas nuevas no coinciden y no llama a la API", async () => {
    render(<ChangePasswordCard />);

    await fill("Antigua1!", "Nueva123!", "Otra123!");

    expect(screen.getByText("Las contraseñas no coinciden")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cambiar contraseña" })).toBeDisabled();
  });

  it("muestra el error traducido si la contraseña actual es incorrecta", async () => {
    vi.mocked(changePassword).mockRejectedValue({ response: { data: { code: "CurrentPasswordIncorrect" } } });
    const snackbar = vi.fn();
    window.addEventListener("rffm.show_snackbar", snackbar);

    render(<ChangePasswordCard />);
    await fill("Mala1!", "Nueva123!", "Nueva123!");
    await userEvent.click(screen.getByRole("button", { name: "Cambiar contraseña" }));

    await waitFor(() => expect(snackbar).toHaveBeenCalled());
    const event = snackbar.mock.calls[0][0] as CustomEvent<{ message: string; severity: string }>;
    expect(event.detail).toEqual({ message: "La contraseña actual no es correcta.", severity: "error" });
    window.removeEventListener("rffm.show_snackbar", snackbar);
  });

  it("al cambiarla, vacía el formulario", async () => {
    vi.mocked(changePassword).mockResolvedValue();

    render(<ChangePasswordCard />);
    await fill("Antigua1!", "Nueva123!", "Nueva123!");
    await userEvent.click(screen.getByRole("button", { name: "Cambiar contraseña" }));

    await waitFor(() => expect(screen.getByLabelText(/contraseña actual/i)).toHaveValue(""));
    expect(changePassword).toHaveBeenCalledWith({ currentPassword: "Antigua1!", newPassword: "Nueva123!" });
  });
});
