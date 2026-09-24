import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Bridges Service Worker push messages into the app while a tab is open:
 * a push received in foreground is shown as the existing rffm.show_snackbar toast
 * (design.md Decisión 6), and a notification click while the tab is already open
 * navigates via React Router instead of a full page load.
 */
export function useWebPushForegroundBridge(): void {
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const serviceWorkerContainer = navigator.serviceWorker;

    function onMessage(event: MessageEvent) {
      const data = event.data || {};
      if (data.type === "rffm.push_received") {
        window.dispatchEvent(
          new CustomEvent("rffm.show_snackbar", {
            detail: { message: data.body || data.title || "", severity: "info" },
          })
        );
      } else if (data.type === "rffm.notification_click" && data.deepLinkPath) {
        navigate(data.deepLinkPath);
      }
    }

    serviceWorkerContainer.addEventListener("message", onMessage);
    return () => serviceWorkerContainer.removeEventListener("message", onMessage);
  }, [navigate]);
}
