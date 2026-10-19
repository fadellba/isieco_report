import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client.js';
import { RoleCode, ClientType, UserProfile } from '@isieco/shared';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: UserProfile) => void;
  hasRole: (roles: RoleCode | RoleCode[]) => boolean;
  hasAnyRole: (roles: RoleCode[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Vérifier la session active au chargement
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await api.get<{ success: boolean; user: UserProfile }>('/auth/me');
        if (res.success && res.user) {
          setUser(res.user);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post<{ success: boolean; user: UserProfile }>('/auth/login', {
      email,
      password,
      clientType: ClientType.WEB,
    });
    if (res.success && res.user) {
      setUser(res.user);
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
    }
  };

  const updateUser = (nextUser: UserProfile) => {
    setUser(nextUser);
  };

  const hasRole = (role: RoleCode | RoleCode[]) => {
    if (!user) return false;
    const required = Array.isArray(role) ? role : [role];
    return required.some((r) => user.roles.includes(r));
  };

  const hasAnyRole = (roles: RoleCode[]) => {
    if (!user) return false;
    if (user.roles.includes(RoleCode.ADMIN)) return true; // Admin a accès transversal
    return roles.some((r) => user.roles.includes(r));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        updateUser,
        hasRole,
        hasAnyRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
