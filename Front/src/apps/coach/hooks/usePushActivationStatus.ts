import { useEffect, useState } from "react";
import {
  getCurrentPushSubscriptionStatus,
  isPushNotificationsSupported,
} from "../services/pushSubscriptionService";

export function usePushActivationStatus(): { shouldPrompt: boolean } {
  const [shouldPrompt, setShouldPrompt] = useState(false);

  useEffect(() => {
    // A denied permission can't be re-prompted from the page, so the banner would lead nowhere.
    const canPrompt = isPushNotificationsSupported() && Notification.permission !== "denied";
    if (!canPrompt) return;

    let cancelled = false;
    getCurrentPushSubscriptionStatus()
      .then((isSubscribed) => {
        if (!cancelled) setShouldPrompt(!isSubscribed);
      })
      .catch(() => {
        if (!cancelled) setShouldPrompt(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { shouldPrompt };
}
