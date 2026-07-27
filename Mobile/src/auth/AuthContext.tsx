import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api, setApiTokenGetter } from '../api/client';
import * as SecureStore from '../auth/secureStore';

interface AuthContextType {
  token: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
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
      await SecureStore.deleteToken();
      setToken(null);
      setIsAuthenticated(false);
      setError(null);
    } catch (e) {
      console.error('Logout error:', e);
      throw e;
    }
  }, []);

  return (
    <AuthContext.Provider value={{ token, isAuthenticated, login, logout, error }}>
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
