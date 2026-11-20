import axios from "axios";
import { coachAuthService } from "../../apps/coach/services/authService";
import { traceAuth } from "../diagnostics/authTrace";
import {
  clearStaleSession,
  registerErrorRedirect,
  resetErrorRedirects,
} from "./sessionRecovery";

// Extend the single Axios instance's config type so callers can opt a specific
// request out of the global 500/network/timeout redirect (see gotoErrorPage below).
declare module "axios" {
  export interface AxiosRequestConfig {
    suppressErrorRedirect?: boolean;
    /** Network-error retries already made for this request (see the response interceptor). */
    retryCount?: number;
  }
}

const BASE = (import.meta.env.VITE_API_BASE_URL || "/")
  .toString()
  .replace(/\/?$/, "/");

const DEFAULT_TIMEOUT = Number(import.meta.env.VITE_API_TIMEOUT ?? 60000);

export const client = axios.create({
  baseURL: BASE,
  timeout: DEFAULT_TIMEOUT,
  // Avoid axios fetch adapter runtime issues in some browser/bundle contexts.
  adapter: "xhr",
});

export const DEFAULT_RETRIES = Number(import.meta.env.VITE_API_RETRIES ?? 3);

// navigation helper: React app can register a navigate function (e.g. from useNavigate)
let navigateTo: ((path: string) => void) | null = null;
export function registerNavigate(fn: (path: string) => void) {
  navigateTo = fn;
}

// Prevent spamming auth_expired across many simultaneous requests.
let authExpiredNotified = false;
function notifyAuthExpiredOnce() {
  try {
    if (typeof window === "undefined") return;

    // If already notified recently, skip.
    if (authExpiredNotified) return;

    // If user is already on a public auth route, no need to emit event.
    const publicPrefixes = [
      "/login",
      "/register",
      "/forgot-password",
      "/reset-password",
    ];
    try {
      const p = window.location?.pathname ?? "";
      if (publicPrefixes.some((x) => p.startsWith(x))) return;
    } catch (e) {
      // ignore
    }

    authExpiredNotified = true;
    window.dispatchEvent(new CustomEvent("rffm.auth_expired"));

    // reset flag after short delay so future login/logout cycles still notify
    setTimeout(() => {
      authExpiredNotified = false;
    }, 2000);
  } catch (e) {
    // ignore
  }
}

// Mobile WebKit (iOS) rejects in-flight XHRs without a response when the page is
// being unloaded (e.g. a full-page redirect right after login). Those aborts are not
// real network failures and must not feed the error-redirect / session-reset loop.
let pageUnloading = false;
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    pageUnloading = true;
  });
  window.addEventListener("pageshow", () => {
    pageUnloading = false;
  });
}

// A burst of GETs right after login can fail all at once on mobile Safari (dropped or reset
// connection): a short retry recovers them without bothering the user.
const NETWORK_RETRIES = 2;
const NETWORK_RETRY_DELAY_MS = 400;

function hasAuthorizationHeader(config: any): boolean {
  const headers = config?.headers;
  if (!headers) return false;
  return Boolean(headers.Authorization ?? headers.authorization ?? headers.get?.("Authorization"));
}

function gotoErrorPage(reason?: string, error?: any) {
  if (pageUnloading) return;
  const suffix = reason ? `?reason=${encodeURIComponent(reason)}` : "";
  let path = `/error-500${suffix}`;
  traceAuth("http.error_redirect", {
    reason: reason ?? "500",
    method: error?.config?.method,
    url: error?.config?.url,
    code: error?.code,
    hasAuthHeader: hasAuthorizationHeader(error?.config),
    retryCount: error?.config?.retryCount ?? 0,
    online: typeof navigator !== "undefined" ? navigator.onLine : null,
  });
  // Repeated server-error redirects in a short window mean the stored session is likely
  // stale and the app boots into the same failure every time: reset it once. A network or
  // timeout failure says nothing about the session, so it never wipes a valid token.
  const transportFailure = reason === "network" || reason === "timeout";
  if (!transportFailure && registerErrorRedirect()) {
    clearStaleSession();
    resetErrorRedirects();
    path = "/login";
  }
  try {
    if (navigateTo) {
      navigateTo(path);
      return;
    }
    // fallback: change location
    if (typeof window !== "undefined") window.location.href = path;
  } catch (e) {
    // no-op
  }
}

// Response interceptor to catch 500 internal server errors
client.interceptors.response.use(
  (resp) => resp,
  (error) => {
    try {
      const status = error?.response?.status;
      // If unauthorized, notify app so it can ask user to re-authenticate
      if (status === 401) {
        try {
          traceAuth("http.401", {
            method: error?.config?.method,
            url: error?.config?.url,
          });
          try {
            coachAuthService.logout("http_401");
          } catch (e) {}
          notifyAuthExpiredOnce();
        } catch (e) {
          // ignore
        }
        return Promise.reject(error);
      }
      const suppressRedirect = error?.config?.suppressErrorRedirect === true;

      // network error (no response)
      if (!error?.response) {
        // axios uses code 'ECONNABORTED' for timeouts
        if (error?.code === "ECONNABORTED") {
          if (!suppressRedirect) gotoErrorPage("timeout", error);
        } else {
          const config = error?.config;
          const attempts: number = config?.retryCount ?? 0;
          const retryable =
            String(config?.method ?? "").toLowerCase() === "get" &&
            !suppressRedirect &&
            !pageUnloading &&
            attempts < NETWORK_RETRIES;
          if (retryable) {
            return new Promise((resolve) => setTimeout(resolve, NETWORK_RETRY_DELAY_MS * (attempts + 1))).then(() =>
              client.request({ ...config, retryCount: attempts + 1 }),
            );
          }
          if (!suppressRedirect) gotoErrorPage("network", error);
        }
        return Promise.reject(error);
      }

      if (status === 500) {
        if (!suppressRedirect) gotoErrorPage(undefined, error);
        return Promise.reject(error);
      }
    } catch (e) {
      // ignore interceptor errors
    }
    return Promise.reject(error);
  },
);

export default client;

// Attach Authorization header from localStorage token for all requests
client.interceptors.request.use(
  (config) => {
    try {
      // Avoid double /api prefix when VITE_API_BASE_URL is set to "/api" and
      // requests already start with "/api".
      const base = (config.baseURL ?? "").toString();
      if (base.endsWith("/api") || base.endsWith("/api/")) {
        if (typeof config.url === "string" && config.url.startsWith("/api/")) {
          config.url = config.url.replace(/^\/api/, "");
        }
      }

      if (typeof window !== "undefined") {
        const token = localStorage.getItem("coachAuthToken");
        if (token) {
          // If the token exists but is already expired according to coachAuthService,
          // proactively remove it and notify the app once so it can log out and prompt for credentials.
          if (!coachAuthService.isAuthenticated()) {
            try {
              coachAuthService.logout("request_with_expired_token");
            } catch (e) {}
            try {
              notifyAuthExpiredOnce();
            } catch (e) {}
          } else {
            // token ok
            if (!config.headers) config.headers = {} as any;
            config.headers.Authorization = `Bearer ${token}`;
          }
        }
      }
    } catch (e) {
      // ignore
    }
    return config;
  },
  (error) => Promise.reject(error),
);
