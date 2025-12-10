import axios from "axios";
import { coachAuthService } from "../../apps/coach/services/authService";

const BASE = (import.meta.env.VITE_API_BASE_URL || "/")
  .toString()
  .replace(/\/?$/, "/");

const DEFAULT_TIMEOUT = Number(import.meta.env.VITE_API_TIMEOUT ?? 60000);

export const client = axios.create({ baseURL: BASE, timeout: DEFAULT_TIMEOUT });

export const DEFAULT_RETRIES = Number(import.meta.env.VITE_API_RETRIES ?? 3);

// navigation helper: React app can register a navigate function (e.g. from useNavigate)
let navigateTo: ((path: string) => void) | null = null;
export function registerNavigate(fn: (path: string) => void) {
  navigateTo = fn;
}

function gotoErrorPage(reason?: string) {
  const suffix = reason ? `?reason=${encodeURIComponent(reason)}` : "";
  const path = `/error-500${suffix}`;
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
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("rffm.auth_expired"));
          }
        } catch (e) {
          // ignore
        }
        return Promise.reject(error);
      }
      // network error (no response)
      if (!error?.response) {
        console.error("API network error:", error);
        // axios uses code 'ECONNABORTED' for timeouts
        if (error?.code === "ECONNABORTED") {
          gotoErrorPage("timeout");
        } else {
          gotoErrorPage("network");
        }
        return Promise.reject(error);
      }

      if (status === 500) {
        console.error("API 500 error:", error);
        gotoErrorPage();
        return Promise.reject(error);
      }
    } catch (e) {
      // ignore interceptor errors
    }
    return Promise.reject(error);
  }
);

export default client;

// Attach Authorization header from localStorage token for all requests
client.interceptors.request.use(
  (config) => {
    try {
      if (typeof window !== "undefined") {
        const token = localStorage.getItem("coachAuthToken");
        if (token) {
          // If the token exists but is already expired according to coachAuthService,
          // emit auth_expired so app can log out and prompt for credentials.
          if (!coachAuthService.isAuthenticated()) {
            try {
              window.dispatchEvent(new CustomEvent("rffm.auth_expired"));
            } catch (e) {}
          } else {
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
  (error) => Promise.reject(error)
);
