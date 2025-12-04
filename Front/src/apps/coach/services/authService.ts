import { client } from "../../../core/api/client";

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
    return !!token;
  },

  getToken: () => {
    return localStorage.getItem("coachAuthToken");
  },

  getUserId: () => {
    return localStorage.getItem("coachUserId");
  },
};
