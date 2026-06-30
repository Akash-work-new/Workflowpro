'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, ApiResponse } from '../lib/api';

interface User {
  id: string;
  name: string;
  email: string;
  employeeId: string;
  designation: string;
  role: {
    name: string;
    permissions: string[];
  };
  departmentId: string | null;
  status: string;
  profilePhoto: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<ApiResponse<{ twoFactorRequired?: boolean; tempToken?: string; accessToken?: string; refreshToken?: string; user?: any }>>;
  verify2FA: (token: string, tempToken?: string, isSetup?: boolean) => Promise<ApiResponse>;
  logout: () => Promise<void>;
  updateUserStatus: (status: string) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    const res = await api.get<{ id: string; name: string; email: string; employeeId: string; designation: string; role: any; departmentId: string | null; status: string; profilePhoto: string | null }>('/users/profile');
    if (res.success && res.data) {
      setUser(res.data as any);
      localStorage.setItem('user', JSON.stringify(res.data));
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          const res = await api.get('/users/profile');
          if (res.success && res.data) {
            setUser(res.data as any);
            localStorage.setItem('user', JSON.stringify(res.data));
          } else {
            // Token expired or invalid
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
          }
        } catch (e) {
          console.error('Failed to initialize session profile:', e);
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    if (res.success && res.data) {
      const data = res.data;
      if (!data.twoFactorRequired && data.accessToken && data.refreshToken) {
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        setUser(data.user);
        localStorage.setItem('user', JSON.stringify(data.user));
      }
    }
    return res;
  };

  const verify2FA = async (token: string, tempToken?: string, isSetup: boolean = false) => {
    const res = await api.post('/auth/2fa/verify', { token, tempToken, isSetup });
    if (res.success && res.data && !isSetup) {
      const data = res.data;
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      setUser(data.user);
      localStorage.setItem('user', JSON.stringify(data.user));
    }
    return res;
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      await api.post('/auth/logout', { refreshToken }).catch(() => {});
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
  };

  const updateUserStatus = async (status: string) => {
    const res = await api.put('/users/status', { status });
    if (res.success && user) {
      const updated = { ...user, status };
      setUser(updated);
      localStorage.setItem('user', JSON.stringify(updated));
      return true;
    }
    return false;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, verify2FA, logout, updateUserStatus, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
