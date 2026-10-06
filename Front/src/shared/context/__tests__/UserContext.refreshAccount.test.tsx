import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../services/profile/profileService", () => ({
  getMyAccount: vi.fn(),
}));

import { UserProvider, useUser } from "../UserContext";
import { getMyAccount } from "../../services/profile/profileService";

function Probe() {
  const { user, refreshAccount } = useUser();
  return (
    <div>
      <span data-testid="avatar">{user?.avatar ?? "sin-avatar"}</span>
      <span data-testid="name">{`${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || "sin-nombre"}</span>
      <button onClick={() => void refreshAccount()}>refrescar</button>
    </div>
  );
}

const account = {
  alias: "anag",
  email: "ana@example.com",
  firstName: "Ana",
  lastName: "García",
  secondLastName: null,
  phoneNumber: null,
  avatarUrl: "https://cdn/avatars/a.png",
};

describe("UserContext — refreshAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("carga la foto y el nombre al montar si hay sesión", async () => {
    localStorage.setItem("coachAuthToken", "token");
    localStorage.setItem("rffm_user", JSON.stringify({ id: "u1", username: "anag" }));
    vi.mocked(getMyAccount).mockResolvedValue(account);

    render(
      <UserProvider>
        <Probe />
      </UserProvider>
    );

    expect(await screen.findByText("https://cdn/avatars/a.png")).toBeInTheDocument();
    expect(screen.getByTestId("name")).toHaveTextContent("Ana García");
    expect(JSON.parse(localStorage.getItem("rffm_user") ?? "{}").avatar).toBe("https://cdn/avatars/a.png");
  });

  it("no llama a la API sin sesión", () => {
    render(
      <UserProvider>
        <Probe />
      </UserProvider>
    );

    expect(getMyAccount).not.toHaveBeenCalled();
  });

  it("mantiene el usuario si la API falla", async () => {
    localStorage.setItem("coachAuthToken", "token");
    localStorage.setItem("rffm_user", JSON.stringify({ id: "u1", username: "anag" }));
    vi.mocked(getMyAccount).mockRejectedValue(new Error("network"));

    render(
      <UserProvider>
        <Probe />
      </UserProvider>
    );

    await waitFor(() => expect(getMyAccount).toHaveBeenCalled());
    expect(screen.getByTestId("avatar")).toHaveTextContent("sin-avatar");
  });

  it("quita la foto del usuario cuando la cuenta ya no la tiene", async () => {
    localStorage.setItem("coachAuthToken", "token");
    localStorage.setItem("rffm_user", JSON.stringify({ id: "u1", username: "anag", avatar: "https://cdn/old.png" }));
    vi.mocked(getMyAccount).mockResolvedValue({ ...account, avatarUrl: null });

    render(
      <UserProvider>
        <Probe />
      </UserProvider>
    );

    await act(async () => {
      screen.getByRole("button", { name: "refrescar" }).click();
    });

    await waitFor(() => expect(screen.getByTestId("avatar")).toHaveTextContent("sin-avatar"));
  });
});
