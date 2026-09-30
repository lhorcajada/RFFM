import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserProvider } from "../../../../context/UserContext";

vi.mock("../../../../hooks/useMyPendingSanctionsCount", () => ({
  default: () => ({ visible: false, count: 0, teamId: null }),
}));
vi.mock("../../../../hooks/useTeamFundBalance", () => ({
  default: () => ({ visible: false, balance: null, teamId: null }),
}));
vi.mock("../../../../hooks/useAuthToken", () => ({
  default: () => ({ isAuthValid: true, token: "fake-token", refresh: vi.fn() }),
}));
vi.mock("../../../../hooks/useRootClassObserver", () => ({
  default: () => {},
}));
vi.mock("../../../../services/versionService", async () => {
  const actual = await vi.importActual<typeof import("../../../../services/versionService")>(
    "../../../../services/versionService"
  );
  return {
    ...actual,
    getWebVersion: vi.fn(),
    getApiVersion: vi.fn(),
  };
});

import AppHeader from "../AppHeader";
import { getApiVersion, getWebVersion } from "../../../../services/versionService";

function renderHeader() {
  return render(
    <MemoryRouter>
      <UserProvider>
        <AppHeader />
      </UserProvider>
    </MemoryRouter>
  );
}

describe("AppHeader — versión de la aplicación", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getWebVersion).mockReturnValue({ version: "1.0.0", commit: "9be4c62" });
  });

  it("muestra la versión web y la de la API al abrir el menú de usuario", async () => {
    vi.mocked(getApiVersion).mockResolvedValue({ version: "1.0.0", commit: "abc1234" });

    renderHeader();
    await userEvent.click(screen.getByRole("button", { name: /abrir menú/i }));

    expect(screen.getByText("Web v1.0.0 (9be4c62)")).toBeInTheDocument();
    expect(await screen.findByText("API v1.0.0 (abc1234)")).toBeInTheDocument();
  });

  it("indica que la versión de la API no está disponible si la llamada falla", async () => {
    vi.mocked(getApiVersion).mockRejectedValue(new Error("network"));

    renderHeader();
    await userEvent.click(screen.getByRole("button", { name: /abrir menú/i }));

    expect(await screen.findByText("API no disponible")).toBeInTheDocument();
  });
});
