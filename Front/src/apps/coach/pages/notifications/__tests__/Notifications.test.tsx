import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserProvider } from "../../../../../shared/context/UserContext";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("../../../services/notificationService", () => ({
  searchNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
}));

vi.mock("../../../../../shared/hooks/useAuditPageAccess", () => ({
  useAuditPageAccess: vi.fn(),
}));

vi.mock("../../../services/pushSubscriptionService", () => ({
  isPushNotificationsSupported: () => false,
  getCurrentPushSubscriptionStatus: vi.fn(),
  subscribeToPushNotifications: vi.fn(),
  unsubscribeFromPushNotifications: vi.fn(),
}));

import { searchNotifications, markNotificationRead } from "../../../services/notificationService";
import type { NotificationResponse } from "../../../services/notificationService";
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

    await waitFor(() => expect(searchNotifications).toHaveBeenCalledWith(2, 25));
  });
});
