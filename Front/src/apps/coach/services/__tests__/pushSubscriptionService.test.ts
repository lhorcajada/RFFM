import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../../../core/api/client", () => ({
  __esModule: true,
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

import client from "../../../../core/api/client";
import {
  getVapidPublicKey,
  subscribe,
  unsubscribe,
  isPushNotificationsSupported,
  requestPushPermission,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
} from "../pushSubscriptionService";

describe("pushSubscriptionService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    delete (navigator as any).serviceWorker;
    delete (window as any).PushManager;
    delete (window as any).Notification;
  });

  it("getVapidPublicKey returns the backend's public key", async () => {
    (client.get as any).mockResolvedValue({ data: { publicKey: "abc123" } });
    const result = await getVapidPublicKey();
    expect(client.get).toHaveBeenCalledWith("/api/push/vapid-public-key");
    expect(result).toEqual({ publicKey: "abc123" });
  });

  it("subscribe posts the subscription payload", async () => {
    (client.post as any).mockResolvedValue({});
    await subscribe({ endpoint: "e", p256dhKey: "p", authKey: "a" });
    expect(client.post).toHaveBeenCalledWith("/api/push/subscriptions", {
      endpoint: "e",
      p256dhKey: "p",
      authKey: "a",
    });
  });

  it("unsubscribe deletes by endpoint", async () => {
    (client.delete as any).mockResolvedValue({});
    await unsubscribe("e");
    expect(client.delete).toHaveBeenCalledWith("/api/push/subscriptions", {
      data: { endpoint: "e" },
    });
  });

  it("isPushNotificationsSupported returns false when serviceWorker/PushManager/Notification are missing", () => {
    expect(isPushNotificationsSupported()).toBe(false);
  });

  it("requestPushPermission devuelve true cuando el usuario concede el permiso", async () => {
    (window as any).Notification = { requestPermission: vi.fn().mockResolvedValue("granted") };
    (window as any).PushManager = function () {};
    Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: {} });

    expect(await requestPushPermission()).toBe(true);
  });

  it("requestPushPermission devuelve false cuando el usuario deniega el permiso", async () => {
    (window as any).Notification = { requestPermission: vi.fn().mockResolvedValue("denied") };
    (window as any).PushManager = function () {};
    Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: {} });

    expect(await requestPushPermission()).toBe(false);
  });

  it("requestPushPermission devuelve false cuando el navegador no soporta push", async () => {
    expect(await requestPushPermission()).toBe(false);
  });

  it("subscribeToPushNotifications returns false when notification permission is denied", async () => {
    (window as any).Notification = { requestPermission: vi.fn().mockResolvedValue("denied") };
    (window as any).PushManager = function () {};
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register: vi.fn() },
    });

    const result = await subscribeToPushNotifications();

    expect(result).toBe(false);
    expect(client.post).not.toHaveBeenCalled();
  });

  it("subscribeToPushNotifications registers the SW, subscribes and posts to the backend when granted", async () => {
    const pushSubscription = {
      toJSON: () => ({ endpoint: "https://push.example/1", keys: { p256dh: "p256dh-key", auth: "auth-key" } }),
    };
    const registration = {
      pushManager: { subscribe: vi.fn().mockResolvedValue(pushSubscription) },
    };

    (window as any).Notification = { requestPermission: vi.fn().mockResolvedValue("granted") };
    (window as any).PushManager = function () {};
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        register: vi.fn().mockResolvedValue(registration),
        ready: Promise.resolve(registration),
      },
    });

    (client.get as any).mockResolvedValue({ data: { publicKey: "QUJD" } });
    (client.post as any).mockResolvedValue({});

    const result = await subscribeToPushNotifications();

    expect(result).toBe(true);
    expect(registration.pushManager.subscribe).toHaveBeenCalled();
    expect(client.post).toHaveBeenCalledWith("/api/push/subscriptions", {
      endpoint: "https://push.example/1",
      p256dhKey: "p256dh-key",
      authKey: "auth-key",
    });
  });

  it("subscribeToPushNotifications espera a que el service worker esté activo antes de suscribirse", async () => {
    const pushSubscription = {
      toJSON: () => ({ endpoint: "https://push.example/1", keys: { p256dh: "p", auth: "a" } }),
    };
    const installingRegistration = {
      pushManager: {
        subscribe: vi.fn().mockRejectedValue(new Error("no active Service Worker")),
      },
    };
    const activeRegistration = {
      pushManager: { subscribe: vi.fn().mockResolvedValue(pushSubscription) },
    };

    (window as any).Notification = { requestPermission: vi.fn().mockResolvedValue("granted") };
    (window as any).PushManager = function () {};
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        register: vi.fn().mockResolvedValue(installingRegistration),
        ready: Promise.resolve(activeRegistration),
      },
    });

    (client.get as any).mockResolvedValue({ data: { publicKey: "QUJD" } });
    (client.post as any).mockResolvedValue({});

    const result = await subscribeToPushNotifications();

    expect(result).toBe(true);
    expect(activeRegistration.pushManager.subscribe).toHaveBeenCalled();
    expect(installingRegistration.pushManager.subscribe).not.toHaveBeenCalled();
  });

  it("unsubscribeFromPushNotifications unsubscribes locally and calls the backend", async () => {
    const pushSubscription = {
      endpoint: "https://push.example/1",
      unsubscribe: vi.fn().mockResolvedValue(true),
    };
    const registration = {
      pushManager: { getSubscription: vi.fn().mockResolvedValue(pushSubscription) },
    };

    (window as any).Notification = {};
    (window as any).PushManager = function () {};
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { getRegistration: vi.fn().mockResolvedValue(registration) },
    });

    (client.delete as any).mockResolvedValue({});

    await unsubscribeFromPushNotifications();

    expect(pushSubscription.unsubscribe).toHaveBeenCalled();
    expect(client.delete).toHaveBeenCalledWith("/api/push/subscriptions", {
      data: { endpoint: "https://push.example/1" },
    });
  });
});
