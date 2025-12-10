import { client } from "../../../core/api/client";

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

export const coachAuthService = {
  login: async (token: string) => {
    const response = await client.post("/api/login", { token });
    return response.data;
  },

  register: async (token: string) => {
    const response = await client.post("/api/register", { token });
    return response.data;
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
};
