import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../../services/pushSubscriptionService", () => ({
  isPushNotificationsSupported: vi.fn(),
  getCurrentPushSubscriptionStatus: vi.fn(),
  requestPushPermission: vi.fn(),
  subscribeToPushNotifications: vi.fn(),
  unsubscribeFromPushNotifications: vi.fn(),
}));

import {
  isPushNotificationsSupported,
  getCurrentPushSubscriptionStatus,
  requestPushPermission,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
} from "../../../../../services/pushSubscriptionService";
import NotificationSettings from "../NotificationSettings";

describe("NotificationSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requestPushPermission as any).mockResolvedValue(true);
  });

  it("no cuenta el tiempo máximo mientras el usuario decide el permiso del navegador", async () => {
    (isPushNotificationsSupported as any).mockReturnValue(true);
    (getCurrentPushSubscriptionStatus as any).mockResolvedValue(false);
    let resolvePermission: (granted: boolean) => void = () => {};
    (requestPushPermission as any).mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolvePermission = resolve;
      })
    );
    (subscribeToPushNotifications as any).mockResolvedValue(true);

    const snackbarSpy = vi.fn();
    window.addEventListener("rffm.show_snackbar", snackbarSpy as EventListener);

    render(<NotificationSettings operationTimeoutMs={50} />);
    const toggle = await screen.findByRole("checkbox", { name: /notificaciones push/i });
    await userEvent.click(toggle);
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(snackbarSpy).not.toHaveBeenCalled();

    resolvePermission(true);

    await waitFor(() => expect(toggle).toBeChecked());
    const event = snackbarSpy.mock.calls[snackbarSpy.mock.calls.length - 1][0] as CustomEvent;
    expect(event.detail.severity).toBe("success");

    window.removeEventListener("rffm.show_snackbar", snackbarSpy as EventListener);
  });

  it("no intenta suscribirse y muestra un error si el usuario deniega el permiso", async () => {
    (isPushNotificationsSupported as any).mockReturnValue(true);
    (getCurrentPushSubscriptionStatus as any).mockResolvedValue(false);
    (requestPushPermission as any).mockResolvedValue(false);

    const snackbarSpy = vi.fn();
    window.addEventListener("rffm.show_snackbar", snackbarSpy as EventListener);

    render(<NotificationSettings />);
    const toggle = await screen.findByRole("checkbox", { name: /notificaciones push/i });
    await userEvent.click(toggle);

    await waitFor(() => expect(snackbarSpy).toHaveBeenCalled());
    expect(subscribeToPushNotifications).not.toHaveBeenCalled();
    expect(toggle).not.toBeChecked();
    const event = snackbarSpy.mock.calls[snackbarSpy.mock.calls.length - 1][0] as CustomEvent;
    expect(event.detail.severity).toBe("error");

    window.removeEventListener("rffm.show_snackbar", snackbarSpy as EventListener);
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

  it("bloquea la pantalla mientras se activan las notificaciones hasta recibir la respuesta", async () => {
    (isPushNotificationsSupported as any).mockReturnValue(true);
    (getCurrentPushSubscriptionStatus as any).mockResolvedValue(false);
    let resolveSubscribe: (value: boolean) => void = () => {};
    (subscribeToPushNotifications as any).mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveSubscribe = resolve;
      })
    );

    render(<NotificationSettings />);
    const toggle = await screen.findByRole("checkbox", { name: /notificaciones push/i });
    await userEvent.click(toggle);

    expect(await screen.findByText(/activando notificaciones/i)).toBeInTheDocument();

    resolveSubscribe(true);

    await waitFor(() =>
      expect(screen.queryByText(/activando notificaciones/i)).not.toBeInTheDocument()
    );
  });

  it("bloquea la pantalla mientras se desactivan las notificaciones hasta recibir la respuesta", async () => {
    (isPushNotificationsSupported as any).mockReturnValue(true);
    (getCurrentPushSubscriptionStatus as any).mockResolvedValue(true);
    let resolveUnsubscribe: () => void = () => {};
    (unsubscribeFromPushNotifications as any).mockReturnValue(
      new Promise<void>((resolve) => {
        resolveUnsubscribe = resolve;
      })
    );

    render(<NotificationSettings />);
    const toggle = await screen.findByRole("checkbox", { name: /notificaciones push/i });
    await waitFor(() => expect(toggle).toBeChecked());
    await userEvent.click(toggle);

    expect(await screen.findByText(/desactivando notificaciones/i)).toBeInTheDocument();

    resolveUnsubscribe();

    await waitFor(() =>
      expect(screen.queryByText(/desactivando notificaciones/i)).not.toBeInTheDocument()
    );
  });

  it("desbloquea la pantalla y muestra un error si la activación no responde a tiempo", async () => {
    (isPushNotificationsSupported as any).mockReturnValue(true);
    (getCurrentPushSubscriptionStatus as any).mockResolvedValue(false);
    (subscribeToPushNotifications as any).mockReturnValue(new Promise<boolean>(() => {}));

    const snackbarSpy = vi.fn();
    window.addEventListener("rffm.show_snackbar", snackbarSpy as EventListener);

    render(<NotificationSettings operationTimeoutMs={50} />);
    const toggle = await screen.findByRole("checkbox", { name: /notificaciones push/i });
    await userEvent.click(toggle);

    await waitFor(() =>
      expect(screen.queryByText(/activando notificaciones/i)).not.toBeInTheDocument()
    );
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
