import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../../services/pushSubscriptionService", () => ({
  isPushNotificationsSupported: vi.fn(),
  getCurrentPushSubscriptionStatus: vi.fn(),
  subscribeToPushNotifications: vi.fn(),
  unsubscribeFromPushNotifications: vi.fn(),
}));

import {
  isPushNotificationsSupported,
  getCurrentPushSubscriptionStatus,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
} from "../../../../../services/pushSubscriptionService";
import NotificationSettings from "../NotificationSettings";

describe("NotificationSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows an unsupported message when the browser lacks push support", async () => {
    (isPushNotificationsSupported as any).mockReturnValue(false);

    render(<NotificationSettings />);

    expect(
      await screen.findByText(/tu navegador no soporta notificaciones push/i)
    ).toBeInTheDocument();
  });

  it("shows the toggle as off when not currently subscribed", async () => {
    (isPushNotificationsSupported as any).mockReturnValue(true);
    (getCurrentPushSubscriptionStatus as any).mockResolvedValue(false);

    render(<NotificationSettings />);

    const toggle = await screen.findByRole("checkbox", { name: /notificaciones push/i });
    expect(toggle).not.toBeChecked();
  });

  it("shows the toggle as on when already subscribed", async () => {
    (isPushNotificationsSupported as any).mockReturnValue(true);
    (getCurrentPushSubscriptionStatus as any).mockResolvedValue(true);

    render(<NotificationSettings />);

    const toggle = await screen.findByRole("checkbox", { name: /notificaciones push/i });
    await waitFor(() => expect(toggle).toBeChecked());
  });

  it("subscribes and shows a success snackbar when the toggle is switched on", async () => {
    (isPushNotificationsSupported as any).mockReturnValue(true);
    (getCurrentPushSubscriptionStatus as any).mockResolvedValue(false);
    (subscribeToPushNotifications as any).mockResolvedValue(true);

    const snackbarSpy = vi.fn();
    window.addEventListener("rffm.show_snackbar", snackbarSpy as EventListener);

    render(<NotificationSettings />);
    const toggle = await screen.findByRole("checkbox", { name: /notificaciones push/i });
    await userEvent.click(toggle);

    await waitFor(() => expect(subscribeToPushNotifications).toHaveBeenCalled());
    await waitFor(() => expect(toggle).toBeChecked());
    expect(snackbarSpy).toHaveBeenCalled();
    const event = snackbarSpy.mock.calls[0][0] as CustomEvent;
    expect(event.detail.severity).toBe("success");

    window.removeEventListener("rffm.show_snackbar", snackbarSpy as EventListener);
  });

  it("shows an error snackbar and keeps the toggle off when permission is denied", async () => {
    (isPushNotificationsSupported as any).mockReturnValue(true);
    (getCurrentPushSubscriptionStatus as any).mockResolvedValue(false);
    (subscribeToPushNotifications as any).mockResolvedValue(false);

    const snackbarSpy = vi.fn();
    window.addEventListener("rffm.show_snackbar", snackbarSpy as EventListener);

    render(<NotificationSettings />);
    const toggle = await screen.findByRole("checkbox", { name: /notificaciones push/i });
    await userEvent.click(toggle);

    await waitFor(() => expect(subscribeToPushNotifications).toHaveBeenCalled());
    expect(toggle).not.toBeChecked();
    const event = snackbarSpy.mock.calls[snackbarSpy.mock.calls.length - 1][0] as CustomEvent;
    expect(event.detail.severity).toBe("error");

    window.removeEventListener("rffm.show_snackbar", snackbarSpy as EventListener);
  });

  it("unsubscribes when the toggle is switched off", async () => {
    (isPushNotificationsSupported as any).mockReturnValue(true);
    (getCurrentPushSubscriptionStatus as any).mockResolvedValue(true);
    (unsubscribeFromPushNotifications as any).mockResolvedValue(undefined);

    render(<NotificationSettings />);
    const toggle = await screen.findByRole("checkbox", { name: /notificaciones push/i });
    await waitFor(() => expect(toggle).toBeChecked());

    await userEvent.click(toggle);

    await waitFor(() => expect(unsubscribeFromPushNotifications).toHaveBeenCalled());
    await waitFor(() => expect(toggle).not.toBeChecked());
  });
});
