import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../../../services/notificationService", () => ({
  NOTIFICATIONS_CHANGED_EVENT: "rffm.notifications_changed",
  searchNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

import NotificationsBell from "../NotificationsBell";
import {
  searchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationApp,
  type NotificationResponse,
} from "../../../../services/notificationService";

const searchMock = vi.mocked(searchNotifications);
const markReadMock = vi.mocked(markNotificationRead);
const markAllReadMock = vi.mocked(markAllNotificationsRead);

function notification(overrides: Partial<NotificationResponse>): NotificationResponse {
  return {
    id: "n1",
    type: "SquadHistoryReady",
    title: "Historial de plantilla listo",
    body: "Ya puedes consultar el historial de CD Ejemplo A.",
    deepLinkPath: "/federation/squad-history/555?seasonId=22",
    isRead: false,
    createdAt: "2026-09-28T10:00:00Z",
    ...overrides,
  };
}

function renderBell(app: NotificationApp = "federation") {
  return render(
    <MemoryRouter>
      <NotificationsBell app={app} />
    </MemoryRouter>,
  );
}

describe("NotificationsBell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    markReadMock.mockResolvedValue();
    markAllReadMock.mockResolvedValue(0);
  });

  it("muestra el número de notificaciones sin leer", async () => {
    searchMock.mockResolvedValue({
      items: [notification({ id: "a" }), notification({ id: "b" }), notification({ id: "c", isRead: true })],
      totalCount: 3,
    });

    renderBell();

    expect(await screen.findByRole("button", { name: /2 notificaciones sin leer/i })).toBeInTheDocument();
  });

  it("sin notificaciones muestra un mensaje vacío al abrir el menú", async () => {
    searchMock.mockResolvedValue({ items: [], totalCount: 0 });
    renderBell();

    await userEvent.click(await screen.findByRole("button", { name: /^notificaciones$/i }));

    expect(await screen.findByText(/no tienes notificaciones/i)).toBeInTheDocument();
  });

  it("al pulsar una notificación la marca como leída y navega a su enlace", async () => {
    searchMock.mockResolvedValue({ items: [notification({})], totalCount: 1 });
    renderBell();

    await userEvent.click(await screen.findByRole("button", { name: /1 notificación sin leer/i }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /historial de plantilla listo/i }));

    await waitFor(() => expect(markReadMock).toHaveBeenCalledWith("n1"));
    expect(navigateMock).toHaveBeenCalledWith("/federation/squad-history/555?seasonId=22");
  });

  it("no vuelve a marcar como leída una notificación ya leída", async () => {
    searchMock.mockResolvedValue({ items: [notification({ isRead: true })], totalCount: 1 });
    renderBell();

    await userEvent.click(await screen.findByRole("button", { name: /^notificaciones$/i }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /historial de plantilla listo/i }));

    expect(markReadMock).not.toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith("/federation/squad-history/555?seasonId=22");
  });

  it("consulta solo las notificaciones de su app sin redirigir a la página de error", async () => {
    searchMock.mockResolvedValue({ items: [], totalCount: 0 });

    renderBell("coach");

    await waitFor(() =>
      expect(searchMock).toHaveBeenCalledWith(1, 20, { suppressErrorRedirect: true, app: "coach" }),
    );
  });

  it("si falla la carga no rompe la cabecera", async () => {
    searchMock.mockRejectedValue(new Error("network"));

    renderBell();

    expect(await screen.findByRole("button", { name: /^notificaciones$/i })).toBeInTheDocument();
  });

  it("marca todas las notificaciones de su app como leídas", async () => {
    searchMock.mockResolvedValue({
      items: [notification({ id: "a" }), notification({ id: "b" })],
      totalCount: 2,
    });
    markAllReadMock.mockImplementation(async () => {
      searchMock.mockResolvedValue({
        items: [notification({ id: "a", isRead: true }), notification({ id: "b", isRead: true })],
        totalCount: 2,
      });
      return 2;
    });
    renderBell("coach");

    await userEvent.click(await screen.findByRole("button", { name: /2 notificaciones sin leer/i }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /marcar todas como leídas/i }));

    expect(markAllReadMock).toHaveBeenCalledWith("coach");
    expect(
      await screen.findByRole("button", { name: /^notificaciones$/i, hidden: true }),
    ).toBeInTheDocument();
  });

  it("avisa al resto de la app al marcar todas como leídas", async () => {
    searchMock.mockResolvedValue({ items: [notification({})], totalCount: 1 });
    markAllReadMock.mockResolvedValue(1);
    const listener = vi.fn();
    window.addEventListener("rffm.notifications_changed", listener);
    renderBell("coach");

    await userEvent.click(await screen.findByRole("button", { name: /1 notificación sin leer/i }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /marcar todas como leídas/i }));

    await waitFor(() => expect(listener).toHaveBeenCalled());
    window.removeEventListener("rffm.notifications_changed", listener);
  });

  it("recarga el contador cuando se marcan notificaciones como leídas desde otra parte de la app", async () => {
    searchMock
      .mockResolvedValueOnce({ items: [notification({})], totalCount: 1 })
      .mockResolvedValue({ items: [notification({ isRead: true })], totalCount: 1 });
    renderBell("coach");
    expect(await screen.findByRole("button", { name: /1 notificación sin leer/i })).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new CustomEvent("rffm.notifications_changed"));
    });

    expect(await screen.findByRole("button", { name: /^notificaciones$/i })).toBeInTheDocument();
  });

  it("no ofrece marcar todas como leídas si no hay notificaciones sin leer", async () => {
    searchMock.mockResolvedValue({ items: [notification({ isRead: true })], totalCount: 1 });
    renderBell();

    await userEvent.click(await screen.findByRole("button", { name: /^notificaciones$/i }));
    await screen.findByRole("menuitem", { name: /historial de plantilla listo/i });

    expect(screen.queryByRole("menuitem", { name: /marcar todas como leídas/i })).not.toBeInTheDocument();
  });
});
