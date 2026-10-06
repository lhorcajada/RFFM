import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../services/profile/profileService", () => ({
  updatePersonalData: vi.fn(),
}));

import PersonalDataCard from "../components/PersonalDataCard";
import { updatePersonalData, type MyAccount } from "../../../services/profile/profileService";

const emptyAccount: MyAccount = {
  alias: "anag",
  email: "ana@example.com",
  firstName: null,
  lastName: null,
  secondLastName: null,
  phoneNumber: null,
  avatarUrl: null,
};

const filledAccount: MyAccount = { ...emptyAccount, firstName: "Ana", lastName: "García" };

describe("PersonalDataCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra el alias y el email como solo lectura", () => {
    render(<PersonalDataCard account={filledAccount} onSaved={vi.fn()} />);

    expect(screen.getByLabelText(/alias/i)).toBeDisabled();
    expect(screen.getByLabelText(/email/i)).toBeDisabled();
    expect(screen.getByLabelText(/alias/i)).toHaveValue("anag");
  });

  it("avisa de que faltan el nombre y el apellido cuando aún no hay datos", () => {
    render(<PersonalDataCard account={emptyAccount} onSaved={vi.fn()} />);

    expect(screen.getByText("Completa tu nombre y apellido")).toBeInTheDocument();
  });

  it("deshabilita «Guardar» mientras falte el nombre o el primer apellido", async () => {
    render(<PersonalDataCard account={emptyAccount} onSaved={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/^nombre/i), "Ana");

    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
  });

  it("guarda los datos, avisa y devuelve la cuenta actualizada", async () => {
    const saved = { ...filledAccount, phoneNumber: "600000000" };
    vi.mocked(updatePersonalData).mockResolvedValue(saved);
    const onSaved = vi.fn();
    const snackbar = vi.fn();
    window.addEventListener("rffm.show_snackbar", snackbar);

    render(<PersonalDataCard account={filledAccount} onSaved={onSaved} />);
    await userEvent.type(screen.getByLabelText(/teléfono/i), "600000000");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
    expect(updatePersonalData).toHaveBeenCalledWith({
      firstName: "Ana",
      lastName: "García",
      secondLastName: null,
      phoneNumber: "600000000",
    });
    expect(snackbar).toHaveBeenCalled();
    window.removeEventListener("rffm.show_snackbar", snackbar);
  });

  it("deshabilita «Guardar» si no hay cambios", () => {
    render(<PersonalDataCard account={filledAccount} onSaved={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
  });
});
