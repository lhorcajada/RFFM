import { useEffect, useRef } from "react";

export const DEFAULT_AUTO_REFRESH_MS = 20000;

// Polls only while the tab is visible and refreshes right away when the user comes back to it,
// so hidden tabs don't hammer the API but the data is fresh as soon as it's looked at again.
export function useAutoRefresh(
  refresh: () => void,
  intervalMs: number = DEFAULT_AUTO_REFRESH_MS,
  enabled = true
) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer === null) timer = setInterval(() => refreshRef.current(), intervalMs);
    };
    const stop = () => {
      if (timer !== null) clearInterval(timer);
      timer = null;
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshRef.current();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [intervalMs, enabled]);
}

export default useAutoRefresh;
