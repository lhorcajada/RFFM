import client from "../../../core/api/client";

export type VapidPublicKeyResponse = {
  publicKey: string;
};

export type SubscribeWebPushRequest = {
  endpoint: string;
  p256dhKey: string;
  authKey: string;
};

export async function getVapidPublicKey(): Promise<VapidPublicKeyResponse> {
  const response = await client.get("/api/push/vapid-public-key");
  return response.data;
}

export async function subscribe(request: SubscribeWebPushRequest): Promise<void> {
  await client.post("/api/push/subscriptions", request);
}

export async function unsubscribe(endpoint: string): Promise<void> {
  await client.delete("/api/push/subscriptions", { data: { endpoint } });
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushNotificationsSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof window !== "undefined" &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushNotificationsSupported()) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

// Kept separate from the subscription so callers can wait for the user's decision on the
// browser prompt without counting it against an operation timeout.
export async function requestPushPermission(): Promise<boolean> {
  if (!isPushNotificationsSupported()) return false;
  const permission = await Notification.requestPermission();
  return permission === "granted";
}

/**
 * Full browser flow: request Notification permission, register the Service Worker,
 * subscribe to PushManager with the server's VAPID key, and persist the subscription
 * on the backend. Returns false at any step that isn't possible (unsupported browser,
 * denied permission, registration failure) rather than throwing.
 */
export async function subscribeToPushNotifications(): Promise<boolean> {
  if (!(await requestPushPermission())) return false;

  const registeredWorker = await registerServiceWorker();
  if (!registeredWorker) return false;

  // PushManager.subscribe needs an *active* worker; right after register() it may still be installing.
  const registration = await navigator.serviceWorker.ready;

  const { publicKey } = await getVapidPublicKey();
  const applicationServerKey = urlBase64ToUint8Array(publicKey);

  const pushSubscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: applicationServerKey as BufferSource,
  });

  const json = pushSubscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

  await subscribe({
    endpoint: json.endpoint,
    p256dhKey: json.keys.p256dh,
    authKey: json.keys.auth,
  });

  return true;
}

export async function unsubscribeFromPushNotifications(): Promise<void> {
  if (!isPushNotificationsSupported()) return;

  const registration = await navigator.serviceWorker.getRegistration();
  const pushSubscription = await registration?.pushManager.getSubscription();
  if (!pushSubscription) return;

  const endpoint = pushSubscription.endpoint;
  await pushSubscription.unsubscribe();
  await unsubscribe(endpoint);
}

export async function getCurrentPushSubscriptionStatus(): Promise<boolean> {
  if (!isPushNotificationsSupported()) return false;
  const registration = await navigator.serviceWorker.getRegistration();
  const pushSubscription = await registration?.pushManager.getSubscription();
  return !!pushSubscription;
}
