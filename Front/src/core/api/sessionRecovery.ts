import { coachAuthService } from "../../apps/coach/services/authService";

const REDIRECTS_KEY = "rffm.error_redirects";
const WINDOW_MS = 30_000;
export const MAX_ERROR_REDIRECTS = 2;

export function clearStaleSession() {
  try {
    coachAuthService.logout();
  } catch {
    // ignore
  }
  try {
    localStorage.removeItem("rffm_user");
  } catch {
    // ignore
  }
}

function readRedirects(now: number): number[] {
  try {
    const raw = sessionStorage.getItem(REDIRECTS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t): t is number => typeof t === "number" && now - t < WINDOW_MS,
    );
  } catch {
    return [];
  }
}

/** Records an error-page redirect and tells whether the app is looping on errors. */
export function registerErrorRedirect(now: number = Date.now()): boolean {
  const recent = [...readRedirects(now), now];
  try {
    sessionStorage.setItem(REDIRECTS_KEY, JSON.stringify(recent));
  } catch {
    // ignore
  }
  return recent.length >= MAX_ERROR_REDIRECTS;
}

export function resetErrorRedirects() {
  try {
    sessionStorage.removeItem(REDIRECTS_KEY);
  } catch {
    // ignore
  }
}
