import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../services/pushSubscriptionService", () => ({
  isPushNotificationsSupported: vi.fn(),
  getCurrentPushSubscriptionStatus: vi.fn(),
}));

import PushActivationBanner from "../PushActivationBanner";
import {
  getCurrentPushSubscriptionStatus,
  isPushNotificationsSupported,
} from "../../../../services/pushSubscriptionService";

const mockedSupported = isPushNotificationsSupported as unknown as ReturnType<typeof vi.fn>;
const mockedStatus = getCurrentPushSubscriptionStatus as unknown as ReturnType<typeof vi.fn>;

const BANNER_TEXT = /¿Quieres recibir las notificaciones de las convocatorias\?/i;

function SettingsProbe() {
  const location = useLocation();
  const state = location.state as { section?: string } | null;
  return <div>Ajustes: {state?.section}</div>;
}

function renderBanner() {
  return render(
    <MemoryRouter initialEntries={["/coach/dashboard"]}>
      <Routes>
        <Route path="/coach/dashboard" element={<PushActivationBanner />} />
        <Route path="/coach/settings" element={<SettingsProbe />} />
      </Routes>
    </MemoryRouter>
  );
}

function setPermission(permission: NotificationPermission) {
  vi.stubGlobal("Notification", { permission });
}

describe("PushActivationBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedSupported.mockReturnValue(true);
    mockedStatus.mockResolvedValue(false);
    setPermission("default");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("muestra el banner cuando el navegador no está suscrito", async () => {
    renderBanner();

    expect(await screen.findByText(BANNER_TEXT)).toBeInTheDocument();
  });

  it("no muestra el banner cuando el navegador ya está suscrito", async () => {
    mockedStatus.mockResolvedValue(true);

    renderBanner();

    await vi.waitFor(() => expect(mockedStatus).toHaveBeenCalled());
    expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument();
  });

  it("no muestra el banner cuando el navegador no soporta notificaciones push", async () => {
    mockedSupported.mockReturnValue(false);

    renderBanner();

    await Promise.resolve();
    expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument();
  });

  it("no muestra el banner cuando el usuario denegó el permiso", async () => {
    setPermission("denied");

    renderBanner();

    await Promise.resolve();
    expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument();
  });

  it("al pulsar el botón navega a ajustes con la sección de notificaciones", async () => {
    renderBanner();

    await userEvent.click(await screen.findByRole("button", { name: /activar notificaciones/i }));

    expect(screen.getByText("Ajustes: notifications")).toBeInTheDocument();
  });
});
