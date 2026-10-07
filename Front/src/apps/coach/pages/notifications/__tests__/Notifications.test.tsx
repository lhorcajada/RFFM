import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserProvider } from "../../../../../shared/context/UserContext";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("../../../../../shared/services/notificationService", () => ({
  NOTIFICATIONS_CHANGED_EVENT: "rffm.notifications_changed",
  searchNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  deleteNotifications: vi.fn(),
  deleteAllNotifications: vi.fn(),
}));

vi.mock("../../../../../shared/hooks/useAuditPageAccess", () => ({
  useAuditPageAccess: vi.fn(),
}));

vi.mock("../../../services/pushSubscriptionService", () => ({
  isPushNotificationsSupported: () => false,
  requiresHomeScreenInstallForPush: () => false,
  getCurrentPushSubscriptionStatus: vi.fn(),
  subscribeToPushNotifications: vi.fn(),
  unsubscribeFromPushNotifications: vi.fn(),
}));

import {
  searchNotifications,
  markNotificationRead,
  deleteNotifications,
  deleteAllNotifications,
} from "../../../../../shared/services/notificationService";
import type { NotificationResponse } from "../../../../../shared/services/notificationService";
import Notifications from "../Notifications";

function renderPage() {
  return render(
    <UserProvider>
      <MemoryRouter>
        <Notifications />
      </MemoryRouter>
    </UserProvider>
  );
}

const sample: NotificationResponse = {
  id: "n1",
  type: "NewsPublished",
  title: "Nueva noticia",
  body: "Hay una nueva noticia disponible.",
  deepLinkPath: "/coach/news/123",
  isRead: false,
  createdAt: "2026-09-20T10:00:00Z",
};

describe("Notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("embeds the push notification toggle at the top of the page, reachable without Settings", async () => {
    (searchNotifications as any).mockResolvedValue({ items: [], totalCount: 0 });
    renderPage();
    expect(
      await screen.findByText(/tu navegador no soporta notificaciones push/i)
    ).toBeInTheDocument();
  });

  it("shows a loading state while fetching", async () => {
    (searchNotifications as any).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("shows an empty state when there are no notifications", async () => {
    (searchNotifications as any).mockResolvedValue({ items: [], totalCount: 0 });
    renderPage();
    expect(await screen.findByText(/no tienes notificaciones/i)).toBeInTheDocument();
  });

  it("shows an error state when the fetch fails", async () => {
    (searchNotifications as any).mockRejectedValue(new Error("boom"));
    renderPage();
    expect(await screen.findByText(/no se pudieron cargar las notificaciones/i)).toBeInTheDocument();
  });

  it("renders notification cards with title and body", async () => {
    (searchNotifications as any).mockResolvedValue({ items: [sample], totalCount: 1 });
    renderPage();
    expect(await screen.findByText("Nueva noticia")).toBeInTheDocument();
    expect(screen.getByText("Hay una nueva noticia disponible.")).toBeInTheDocument();
  });

  it("marks as read and navigates when a notification card is clicked", async () => {
    (searchNotifications as any).mockResolvedValue({ items: [sample], totalCount: 1 });
    (markNotificationRead as any).mockResolvedValue(undefined);
    renderPage();

    const card = await screen.findByText("Nueva noticia");
    await userEvent.click(card);

    await waitFor(() => expect(markNotificationRead).toHaveBeenCalledWith("n1"));
    expect(navigateMock).toHaveBeenCalledWith("/coach/news/123");
  });

  it("avisa al resto de la app al marcar una notificación como leída", async () => {
    (searchNotifications as any).mockResolvedValue({ items: [sample], totalCount: 1 });
    (markNotificationRead as any).mockResolvedValue(undefined);
    const listener = vi.fn();
    window.addEventListener("rffm.notifications_changed", listener);
    renderPage();

    await userEvent.click(await screen.findByText("Nueva noticia"));

    await waitFor(() => expect(listener).toHaveBeenCalled());
    window.removeEventListener("rffm.notifications_changed", listener);
  });

  it("recarga el listado cuando se marcan notificaciones como leídas desde la campana", async () => {
    (searchNotifications as any)
      .mockResolvedValueOnce({ items: [sample], totalCount: 1 })
      .mockResolvedValue({ items: [{ ...sample, isRead: true }], totalCount: 1 });
    renderPage();
    expect(await screen.findByText("Nueva")).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new CustomEvent("rffm.notifications_changed"));
    });

    await waitFor(() => expect(screen.queryByText("Nueva")).not.toBeInTheDocument());
  });

  it("navega al dashboard del equipo al pulsar Volver", async () => {
    (searchNotifications as any).mockResolvedValue({ items: [], totalCount: 0 });
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: /volver/i }));

    expect(navigateMock).toHaveBeenCalledWith("/coach/team-dashboard");
  });

  it("fetches the next page when pagination changes", async () => {
    const items = [sample];
    (searchNotifications as any).mockResolvedValue({ items, totalCount: 50 });
    renderPage();

    await screen.findByText("Nueva noticia");
    const pageTwo = screen.getByRole("button", { name: /go to page 2/i });
    await userEvent.click(pageTwo);

    await waitFor(() => expect(searchNotifications).toHaveBeenCalledWith(2, 25, { app: "coach" }));
  });

  it("solo consulta las notificaciones de Coach", async () => {
    (searchNotifications as any).mockResolvedValue({ items: [], totalCount: 0 });
    renderPage();

    await waitFor(() => expect(searchNotifications).toHaveBeenCalledWith(1, 25, { app: "coach" }));
  });

  describe("selección y borrado", () => {
    const second: NotificationResponse = { ...sample, id: "n2", title: "Convocatoria", isRead: true };

    it("seleccionar una notificación no la abre ni la marca como leída", async () => {
      (searchNotifications as any).mockResolvedValue({ items: [sample], totalCount: 1 });
      renderPage();

      await userEvent.click(await screen.findByRole("checkbox", { name: /seleccionar nueva noticia/i }));

      expect(markNotificationRead).not.toHaveBeenCalled();
      expect(navigateMock).not.toHaveBeenCalled();
    });

    it("el botón Eliminar está deshabilitado si no hay ninguna seleccionada", async () => {
      (searchNotifications as any).mockResolvedValue({ items: [sample], totalCount: 1 });
      renderPage();

      expect(await screen.findByRole("button", { name: /^eliminar$/i })).toBeDisabled();
    });

    it("Seleccionar todas marca todas las notificaciones de la página", async () => {
      (searchNotifications as any).mockResolvedValue({ items: [sample, second], totalCount: 2 });
      renderPage();

      await userEvent.click(await screen.findByRole("checkbox", { name: /seleccionar todas/i }));

      expect(screen.getByRole("checkbox", { name: /seleccionar nueva noticia/i })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: /seleccionar convocatoria/i })).toBeChecked();
      expect(screen.getByRole("button", { name: /eliminar \(2\)/i })).toBeEnabled();
    });

    it("Seleccionar todas de nuevo desmarca todas", async () => {
      (searchNotifications as any).mockResolvedValue({ items: [sample, second], totalCount: 2 });
      renderPage();
      const selectAll = await screen.findByRole("checkbox", { name: /seleccionar todas/i });

      await userEvent.click(selectAll);
      await userEvent.click(selectAll);

      expect(screen.getByRole("checkbox", { name: /seleccionar nueva noticia/i })).not.toBeChecked();
      expect(screen.getByRole("checkbox", { name: /seleccionar convocatoria/i })).not.toBeChecked();
    });

    it("no elimina nada si se cancela la confirmación", async () => {
      (searchNotifications as any).mockResolvedValue({ items: [sample, second], totalCount: 2 });
      renderPage();

      await userEvent.click(await screen.findByRole("checkbox", { name: /seleccionar todas/i }));
      await userEvent.click(screen.getByRole("button", { name: /eliminar \(2\)/i }));
      await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));

      expect(deleteNotifications).not.toHaveBeenCalled();
    });

    it("elimina las seleccionadas tras confirmar y recarga el listado", async () => {
      (searchNotifications as any)
        .mockResolvedValueOnce({ items: [sample, second], totalCount: 2 })
        .mockResolvedValue({ items: [second], totalCount: 1 });
      (deleteNotifications as any).mockResolvedValue(1);
      renderPage();

      await userEvent.click(await screen.findByRole("checkbox", { name: /seleccionar nueva noticia/i }));
      await userEvent.click(screen.getByRole("button", { name: /eliminar \(1\)/i }));
      await userEvent.click(screen.getByRole("button", { name: /^eliminar$/i }));

      await waitFor(() => expect(deleteNotifications).toHaveBeenCalledWith(["n1"]));
      await waitFor(() => expect(screen.queryByText("Nueva noticia")).not.toBeInTheDocument());
      expect(screen.getByText("Convocatoria")).toBeInTheDocument();
    });

    it("Eliminar todas borra las notificaciones de todas las páginas tras confirmar", async () => {
      (searchNotifications as any)
        .mockResolvedValueOnce({ items: [sample, second], totalCount: 60 })
        .mockResolvedValue({ items: [], totalCount: 0 });
      (deleteAllNotifications as any).mockResolvedValue(60);
      renderPage();

      await userEvent.click(await screen.findByRole("button", { name: /eliminar todas/i }));
      expect(screen.getByText(/las 60 notificaciones/i)).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: /^eliminar$/i }));

      await waitFor(() => expect(deleteAllNotifications).toHaveBeenCalledWith("coach"));
      expect(deleteNotifications).not.toHaveBeenCalled();
      expect(await screen.findByText(/no tienes notificaciones/i)).toBeInTheDocument();
    });

    it("Eliminar todas vuelve a la primera página", async () => {
      (searchNotifications as any).mockResolvedValue({ items: [sample], totalCount: 60 });
      (deleteAllNotifications as any).mockResolvedValue(60);
      renderPage();

      await screen.findByText("Nueva noticia");
      await userEvent.click(screen.getByRole("button", { name: /go to page 2/i }));
      await waitFor(() => expect(searchNotifications).toHaveBeenCalledWith(2, 25, { app: "coach" }));
      (searchNotifications as any).mockClear();
      (searchNotifications as any).mockResolvedValue({ items: [], totalCount: 0 });

      await userEvent.click(await screen.findByRole("button", { name: /eliminar todas/i }));
      await userEvent.click(screen.getByRole("button", { name: /^eliminar$/i }));

      await waitFor(() => expect(searchNotifications).toHaveBeenCalledWith(1, 25, { app: "coach" }));
    });

    it("no elimina todas si se cancela la confirmación", async () => {
      (searchNotifications as any).mockResolvedValue({ items: [sample], totalCount: 1 });
      renderPage();

      await userEvent.click(await screen.findByRole("button", { name: /eliminar todas/i }));
      await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));

      expect(deleteAllNotifications).not.toHaveBeenCalled();
    });

    it("avisa con un snackbar de error si falla el borrado", async () => {
      (searchNotifications as any).mockResolvedValue({ items: [sample], totalCount: 1 });
      (deleteNotifications as any).mockRejectedValue(new Error("boom"));
      const listener = vi.fn();
      window.addEventListener("rffm.show_snackbar", listener);
      renderPage();

      await userEvent.click(await screen.findByRole("checkbox", { name: /seleccionar nueva noticia/i }));
      await userEvent.click(screen.getByRole("button", { name: /eliminar \(1\)/i }));
      await userEvent.click(screen.getByRole("button", { name: /^eliminar$/i }));

      await waitFor(() => expect(listener).toHaveBeenCalled());
      expect((listener.mock.calls[0][0] as CustomEvent).detail.severity).toBe("error");
      window.removeEventListener("rffm.show_snackbar", listener);
    });
  });
});
