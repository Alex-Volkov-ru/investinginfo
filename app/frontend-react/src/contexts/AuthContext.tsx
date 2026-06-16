import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { authService } from '../lib/auth';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, full_name: string, password: string, tg_username?: string, phone?: string, tinkoff_token?: string) => Promise<void>;
  logout: () => void;
  updateUser: (patch: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function readStoredUser(): User | null {
  const storedUser = authService.getUser();
  if (storedUser && authService.isAuthenticated()) return storedUser;
  return null;
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => readStoredUser());
  const [isInitializing, setIsInitializing] = useState(() => readStoredUser() === null);

  useEffect(() => {
    const storedUser = readStoredUser();
    setUser(storedUser);
    setIsInitializing(false);
  }, []);

  const login = async (email: string, password: string) => {
    await authService.login({ email, password });
    const nextUser = authService.getUser();
    setUser(nextUser);
  };

  const register = async (email: string, full_name: string, password: string, tg_username?: string, phone?: string, tinkoff_token?: string) => {
    await authService.register({ email, full_name, password, tg_username, phone, tinkoff_token });
    const nextUser = authService.getUser();
    setUser(nextUser);
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  const updateUser = (patch: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated: User = { ...prev, ...patch };
      authService.setUser(updated);
      return updated;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isInitializing,
        login,
        register,
        logout,
        updateUser,
      }}
    >
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
