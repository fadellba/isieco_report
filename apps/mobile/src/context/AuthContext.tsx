import React, { createContext, useContext, useEffect, useState } from 'react';
import { MobileUser } from '../types/index.js';
import { mobileApi, loadStoredAuth } from '../services/api.js';
import { RoleCode } from '@isieco/shared';

interface AuthContextValue {
  user: MobileUser | null;
  token: string | null;
  loading: boolean;
  isCitoyen: boolean;
  isTerrainAgent: boolean;
  login: (email: string, mdp: string) => Promise<void>;
  logout: () => Promise<void>;
  quickLoginAsPersona: (email: string, mdp: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<MobileUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth()
      .then(({ token: savedToken, user: savedUser }) => {
        setToken(savedToken);
        setUser(savedUser);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, mdp: string) => {
    setLoading(true);
    try {
      const res = await mobileApi.auth.login(email, mdp);
      setToken(res.token);
      setUser(res.utilisateur);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await mobileApi.auth.logout();
      setUser(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  const quickLoginAsPersona = async (email: string, mdp: string) => {
    await login(email, mdp);
  };

  const isCitoyen = Boolean(user?.roles?.includes(RoleCode.CITOYEN));
  const isTerrainAgent = Boolean(
    user?.roles?.includes(RoleCode.TERRAIN) || user?.roles?.includes(RoleCode.ADMIN)
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isCitoyen,
        isTerrainAgent,
        login,
        logout,
        quickLoginAsPersona,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
