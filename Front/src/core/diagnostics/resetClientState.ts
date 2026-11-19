import { AUTH_TRACE_KEY, getAuthTrace, traceAuth } from "./authTrace";

/**
 * Wipes everything the app stored in the browser (storage, caches, service workers,
 * readable cookies) so a stuck session cannot survive. The auth trace is kept so the
 * incident can still be diagnosed afterwards.
 */
export async function resetClientState(): Promise<void> {
  const keptTrace = getAuthTrace();
  traceAuth("client.reset");
  const trace = getAuthTrace().length ? getAuthTrace() : keptTrace;

  try {
    localStorage.clear();
  } catch {
    // ignore
  }
  try {
    sessionStorage.clear();
  } catch {
    // ignore
  }
  try {
    localStorage.setItem(AUTH_TRACE_KEY, JSON.stringify(trace));
  } catch {
    // ignore
  }

  try {
    document.cookie.split(";").forEach((c) => {
      const name = c.split("=")[0]?.trim();
      if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    });
  } catch {
    // ignore
  }

  try {
    const regs = await navigator.serviceWorker?.getRegistrations?.();
    await Promise.all((regs ?? []).map((r) => r.unregister()));
  } catch {
    // ignore
  }

  try {
    const cacheApi = typeof window !== "undefined" ? window.caches : undefined;
    if (cacheApi) {
      const keys = await cacheApi.keys();
      await Promise.all(keys.map((k) => cacheApi.delete(k)));
    }
  } catch {
    // ignore
  }
}
