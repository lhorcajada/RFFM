import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../services/pushSubscriptionService", () => ({
  isPushNotificationsSupported: vi.fn(),
  getCurrentPushSubscriptionStatus: vi.fn(),
}));

import PushActivationBanner from "../PushActivationBanner/PushActivationBanner";
import {
  getCurrentPushSubscriptionStatus,
  isPushNotificationsSupported,
} from "../../services/pushSubscriptionService";

const mockedSupported = isPushNotificationsSupported as unknown as ReturnType<typeof vi.fn>;
const mockedStatus = getCurrentPushSubscriptionStatus as unknown as ReturnType<typeof vi.fn>;

type Variant = "card" | "strip" | "row";

function SettingsProbe() {
  const location = useLocation();
  const state = location.state as { section?: string } | null;
  return <div>Ajustes: {state?.section}</div>;
}

function renderBanner(variant: Variant) {
  return render(
    <MemoryRouter initialEntries={["/coach/dashboard"]}>
      <Routes>
        <Route path="/coach/dashboard" element={<PushActivationBanner variant={variant} />} />
        <Route path="/coach/settings" element={<SettingsProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PushActivationBanner — variantes del panel de inicio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedSupported.mockReturnValue(true);
    mockedStatus.mockResolvedValue(false);
    vi.stubGlobal("Notification", { permission: "default" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("la tarjeta de escritorio muestra «No te pierdas nada» y navega a ajustes de notificaciones", async () => {
    renderBanner("card");

    expect(await screen.findByRole("heading", { name: /no te pierdas nada/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^activar notificaciones$/i }));

    expect(screen.getByText("Ajustes: notifications")).toBeInTheDocument();
  });

  it("la franja de tablet navega a ajustes de notificaciones desde su botón", async () => {
    renderBanner("strip");

    await userEvent.click(await screen.findByRole("button", { name: /activar notificaciones/i }));

    expect(screen.getByText("Ajustes: notifications")).toBeInTheDocument();
  });

  it("la fila móvil es un único botón pulsable que navega a ajustes de notificaciones", async () => {
    renderBanner("row");

    const row = await screen.findByRole("button", { name: "Activar notificaciones de convocatorias" });
    expect(screen.getAllByRole("button")).toHaveLength(1);
    await userEvent.click(row);

    expect(screen.getByText("Ajustes: notifications")).toBeInTheDocument();
  });

  it("no muestra ninguna variante cuando el navegador ya está suscrito", async () => {
    mockedStatus.mockResolvedValue(true);

    renderBanner("row");

    await vi.waitFor(() => expect(mockedStatus).toHaveBeenCalled());
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
