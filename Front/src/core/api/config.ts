export type AppType = "federation" | "coach";

export interface ApiConfig {
  baseURL: string;
  timeout?: number;
}

export const API_CONFIGS: Record<AppType, ApiConfig> = {
  federation: {
    baseURL: process.env.VITE_FEDERATION_API_URL || "https://api.rffm.es",
    timeout: 30000,
  },
  coach: {
    baseURL: process.env.VITE_COACH_API_URL || "https://api-coach.rffm.es",
    timeout: 30000,
  },
};

export function getApiConfig(app: AppType): ApiConfig {
  return API_CONFIGS[app];
}
