import axios from 'axios';
import Constants from 'expo-constants';

const API_BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl || 'https://localhost:7287';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

// Type for interceptor token getter
type TokenGetter = () => Promise<string | null>;

let tokenGetter: TokenGetter | null = null;

export const setApiTokenGetter = (getter: TokenGetter) => {
  tokenGetter = getter;
};

// Request interceptor to add Authorization header
api.interceptors.request.use(
  async (config) => {
    if (tokenGetter) {
      const token = await tokenGetter();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling (401 auth expired, etc.)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Auth expired, will be handled by AuthContext to redirect to login
    }
    return Promise.reject(error);
  }
);
