import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../services/profile/profileService", () => ({
  uploadAvatar: vi.fn(),
  deleteAvatar: vi.fn(),
}));

import AvatarCard from "../components/AvatarCard";
import { deleteAvatar, uploadAvatar, type MyAccount } from "../../../services/profile/profileService";

const account: MyAccount = {
  alias: "anag",
  email: "ana@example.com",
  firstName: "Ana",
  lastName: "García",
  secondLastName: null,
  phoneNumber: null,
  avatarUrl: null,
};

describe("AvatarCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deshabilita las acciones si aún no hay datos personales", () => {
    render(<AvatarCard account={{ ...account, firstName: null, lastName: null }} onChanged={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Cambiar foto" })).toBeDisabled();
    expect(screen.getByText("Guarda primero tus datos personales")).toBeInTheDocument();
  });

  it("muestra las iniciales cuando no hay foto", () => {
    render(<AvatarCard account={account} onChanged={vi.fn()} />);

    expect(screen.getByText("AG")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Quitar foto" })).not.toBeInTheDocument();
  });

  it("sube la foto elegida y notifica la nueva URL", async () => {
    vi.mocked(uploadAvatar).mockResolvedValue("https://cdn/avatars/a.png");
    const onChanged = vi.fn();
    const file = new File(["x"], "foto.png", { type: "image/png" });

    render(<AvatarCard account={account} onChanged={onChanged} />);
    await userEvent.upload(screen.getByLabelText("Seleccionar foto"), file);

    await waitFor(() => expect(onChanged).toHaveBeenCalledWith("https://cdn/avatars/a.png"));
    expect(uploadAvatar).toHaveBeenCalledWith(file);
  });

  it("pide confirmación antes de quitar la foto", async () => {
    vi.mocked(deleteAvatar).mockResolvedValue();
    const onChanged = vi.fn();

    render(<AvatarCard account={{ ...account, avatarUrl: "https://cdn/avatars/a.png" }} onChanged={onChanged} />);
    await userEvent.click(screen.getByRole("button", { name: "Quitar foto" }));

    expect(deleteAvatar).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Quitar" }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(null));
    expect(deleteAvatar).toHaveBeenCalled();
  });
});
