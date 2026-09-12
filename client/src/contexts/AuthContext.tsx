import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI, PatientRegistrationPayload } from '../services/api';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  caregiverLogin: (email: string, password: string) => Promise<User>;
  register: (data: PatientRegistrationPayload) => Promise<User & { caregiverInviteLink?: string }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isPatient: boolean;
  isCaregiver: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('sarthak_token');
        if (!token) {
          setLoading(false);
          return;
        }
        const res = await authAPI.me();
        if (res.data.success) {
          setUser(res.data.data);
        } else {
          localStorage.removeItem('sarthak_token');
        }
      } catch {
        localStorage.removeItem('sarthak_token');
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  // Patient login
  const login = useCallback(async (email: string, password: string): Promise<User> => {
    const res = await authAPI.login({ email, password });
    if (res.data.success) {
      setUser(res.data.data);
      if (res.data.token) {
        localStorage.setItem('sarthak_token', res.data.token);
      }
      return res.data.data;
    } else {
      throw new Error(res.data.error || 'Login failed');
    }
  }, []);

  // Caregiver login
  const caregiverLogin = useCallback(async (email: string, password: string): Promise<User> => {
    const res = await authAPI.caregiverLogin({ email, password });
    if (res.data.success) {
      setUser(res.data.data);
      if (res.data.token) {
        localStorage.setItem('sarthak_token', res.data.token);
      }
      return res.data.data;
    } else {
      throw new Error(res.data.error || 'Caregiver login failed');
    }
  }, []);

  // Patient registration
  const register = useCallback(async (data: PatientRegistrationPayload): Promise<User & { caregiverInviteLink?: string }> => {
    const res = await authAPI.register(data);
    if (res.data.success) {
      const userWithLink = {
        ...res.data.data,
        caregiverInviteLink: res.data.caregiverInviteLink || res.data.data?.caregiverInviteLink,
      };
      setUser(userWithLink);
      if (res.data.token) {
        localStorage.setItem('sarthak_token', res.data.token);
      }
      return userWithLink;
    } else {
      throw new Error(res.data.error || 'Registration failed');
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authAPI.logout();
    } catch { /* ignore */ }
    setUser(null);
    localStorage.removeItem('sarthak_token');
  }, []);

  const role = user?.role || '';
  const isPatient = role === 'patient' || role === 'senior';
  const isCaregiver = role === 'caregiver';

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        caregiverLogin,
        register,
        logout,
        isAuthenticated: !!user,
        isPatient,
        isCaregiver,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
