import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../../../services/notificationService", () => ({
  searchNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
}));

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

import FederationNotificationsBell from "../FederationNotificationsBell";
import {
  searchNotifications,
  markNotificationRead,
  type NotificationResponse,
} from "../../../../services/notificationService";

const searchMock = vi.mocked(searchNotifications);
const markReadMock = vi.mocked(markNotificationRead);

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

function renderBell() {
  return render(
    <MemoryRouter>
      <FederationNotificationsBell />
    </MemoryRouter>,
  );
}

describe("FederationNotificationsBell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    markReadMock.mockResolvedValue();
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

  it("consulta las notificaciones sin redirigir a la página de error si fallan", async () => {
    searchMock.mockResolvedValue({ items: [], totalCount: 0 });

    renderBell();

    await waitFor(() =>
      expect(searchMock).toHaveBeenCalledWith(1, 20, { suppressErrorRedirect: true }),
    );
  });

  it("si falla la carga no rompe la cabecera", async () => {
    searchMock.mockRejectedValue(new Error("network"));

    renderBell();

    expect(await screen.findByRole("button", { name: /^notificaciones$/i })).toBeInTheDocument();
  });
});
