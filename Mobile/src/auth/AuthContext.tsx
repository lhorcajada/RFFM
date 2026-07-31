import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { api, setApiTokenGetter } from '../api/client';
import * as SecureStore from '../auth/secureStore';
import { getRolesFromToken } from './roles';
// Lazy require (not a static import): notifications/index.ts pulls in expo-notifications,
// which in turn requires the 'expo' package — a chain many existing screen/navigation tests
// don't (and shouldn't have to) mock. A static import here would execute that chain any time
// AuthContext.tsx is loaded for real, including when Jest automocks this module to build a
// shape for `jest.mock('.../AuthContext')` in unrelated test files. Requiring lazily inside
// login()/logout() defers that cost to actual invocation, which is already covered by an
// explicit `jest.mock('../../notifications', ...)` in AuthContext's own test file.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const getNotificationsModule = () => require('../notifications') as typeof import('../notifications');

interface AuthContextType {
  token: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
  roles: string[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize token from secure store on mount
  useEffect(() => {
    const initializeToken = async () => {
      try {
        const storedToken = await SecureStore.getToken();
        if (storedToken) {
          setToken(storedToken);
          setIsAuthenticated(true);
        }
      } catch (e) {
        console.error('Failed to initialize token:', e);
      }
    };
    initializeToken();
  }, []);

  // Set up token getter for API client
  useEffect(() => {
    setApiTokenGetter(async () => token);
  }, [token]);

  const login = useCallback(async (username: string, password: string) => {
    try {
      setError(null);
      const response = await api.post('/api/mobile/login', {
        username,
        password,
      });
      const newToken = response.data;
      await SecureStore.saveToken(newToken);
      setToken(newToken);
      setIsAuthenticated(true);
      // Fire-and-forget: a slow/failed permission flow must never delay or block login.
      getNotificationsModule()
        .initPushNotifications()
        .catch((e) => console.error('Push notification init failed:', e));
    } catch (e: any) {
      const errorMessage = e.response?.data?.detail || e.message || 'Login failed';
      setError(errorMessage);
      setIsAuthenticated(false);
      setToken(null);
      throw e;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await getNotificationsModule().teardownPushNotifications();
      await SecureStore.deleteToken();
      setToken(null);
      setIsAuthenticated(false);
      setError(null);
    } catch (e) {
      console.error('Logout error:', e);
      throw e;
    }
  }, []);

  const roles = useMemo(() => getRolesFromToken(token), [token]);

  return (
    <AuthContext.Provider value={{ token, isAuthenticated, login, logout, error, roles }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
