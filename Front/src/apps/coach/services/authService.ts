import { client } from "../../../core/api/client";
import type {
  RegisterPayingAccountPayload,
  RegisterPayingAccountResponse,
} from "../../../shared/types/scope";

function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1];
    // atob handles base64; replace URL-safe chars
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(b64)
        .split("")
        .map(function (c) {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join("")
    );
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

function normalizeRole(role: string): string {
  return (role ?? "").trim().toLowerCase();
}

export const coachAuthService = {
  login: async (token: string) => {
    const response = await client.post("/api/login", { token });
    return response.data;
  },

  register: async (token: string) => {
    const response = await client.post("/api/register", { token });
    return response.data;
  },

  registerPayingAccount: async (
    payload: RegisterPayingAccountPayload,
  ): Promise<RegisterPayingAccountResponse> => {
    const response = await client.post("/api/register", payload);
    return response.data as RegisterPayingAccountResponse;
  },

  requestPasswordReset: async (email: string) => {
    const response = await client.post("/api/forgot-password", {
      email,
    });
    return response.data;
  },

  resetPassword: async (token: string, password: string) => {
    const response = await client.post("/api/reset-password", {
      token,
      password,
    });
    return response.data;
  },

  logout: () => {
    localStorage.removeItem("coachAuthToken");
    localStorage.removeItem("coachUserId");
    try {
      localStorage.removeItem("coach_roles");
      localStorage.removeItem("coach_player_teamId");
    } catch (e) {}
  },

  isAuthenticated: () => {
    const token = localStorage.getItem("coachAuthToken");
    if (!token) return false;
    try {
      const decoded: any = decodeJwtPayload(token);
      const exp = decoded?.exp;
      if (!exp) return true; // no exp claim — assume valid
      const now = Math.floor(Date.now() / 1000);
      return exp > now;
    } catch (e) {
      return false;
    }
  },

  getToken: () => {
    return localStorage.getItem("coachAuthToken");
  },

  getUserId: () => {
    return localStorage.getItem("coachUserId");
  },

  // Roles & permissions helpers
  getRoles: (): string[] => {
    const combined = new Set<string>();
    try {
      const token = localStorage.getItem("coachAuthToken");
      if (token) {
        const decoded = decodeJwtPayload(token);
        if (decoded && Array.isArray(decoded.roles)) {
          decoded.roles.forEach((r: string) => combined.add(r));
        }
      }
    } catch (e) {
      // ignore token parse errors
    }

    // Also include roles cached by frontend when API returns roles
    try {
      const raw = localStorage.getItem("coach_roles");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed))
          parsed.forEach((r: string) => combined.add(r));
      }
    } catch (e) {
      // ignore
    }

    return Array.from(combined.values());
  },

  hasRole: (role: string) => {
    const roles = coachAuthService.getRoles();
    if (!roles || roles.length === 0) return false;
    const normalizedRoles = roles.map(normalizeRole);
    if (normalizedRoles.includes("administrator") || normalizedRoles.includes("admin")) return true; // admin bypass
    return normalizedRoles.includes(normalizeRole(role));
  },

  getPermissionsForRole: (role: string): string[] => {
    const token = localStorage.getItem("coachAuthToken");
    if (!token) return [];
    const decoded = decodeJwtPayload(token);
    if (!decoded) return [];
    const rp = decoded.role_permissions ?? decoded.rolePermissions ?? {};
    return Array.isArray(rp?.[role]) ? rp[role] : [];
  },

  hasPermission: (role: string, permission: string) => {
    const normalizedRoles = coachAuthService.getRoles().map(normalizeRole);
    if (normalizedRoles.includes("administrator") || normalizedRoles.includes("admin")) return true;
    const perms = coachAuthService.getPermissionsForRole(role);
    return perms.includes(permission);
  },

  /** Replace the stored JWT with a freshly-issued one (e.g. after role assignment). */
  storeUpdatedToken: (token: string) => {
    localStorage.setItem("coachAuthToken", token);
    try {
      window.dispatchEvent(new CustomEvent("rffm.coach_token_updated"));
    } catch (e) {}
  },
};
