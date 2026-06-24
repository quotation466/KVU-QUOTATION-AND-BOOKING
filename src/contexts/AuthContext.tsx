import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRepository, type User } from '../repositories/UserRepository';

interface AuthContextType {
  currentUser: User | null;
  login: (userId: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isAuthenticated: () => boolean;
  isAdmin: () => boolean;
  isStaff: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        await UserRepository.refreshFromCloud();
        console.log('[AuthContext] Users synced from Supabase.');
      } catch (e) {
        console.warn('[AuthContext] Cloud user sync failed, using cache:', e);
      }

      const stored = localStorage.getItem('kvu_current_user');
      if (stored) {
        try {
          const parsedUser = JSON.parse(stored) as User;
          const activeUsers = UserRepository.getUsers();
          const exists = activeUsers.find(u => u.userId === parsedUser.userId);
          if (exists) {
            setCurrentUser(exists);
          } else {
            localStorage.removeItem('kvu_current_user');
          }
        } catch (e) {
          console.error('[AuthContext] Session restore failed:', e);
          localStorage.removeItem('kvu_current_user');
        }
      }

      setReady(true);
    };

    init();
  }, []);

  const login = async (
    userId: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanId = userId.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanId || !cleanPass) {
      return { success: false, error: 'Both User ID and Password are required!' };
    }

    const user = await UserRepository.verifyCredentials(cleanId, cleanPass);

    if (!user) {
      return { success: false, error: 'Invalid User ID or Password!' };
    }

    const { passwordHash, salt, ...safeUser } = user;
    setCurrentUser(safeUser);
    localStorage.setItem('kvu_current_user', JSON.stringify(safeUser));
    return { success: true };
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('kvu_current_user');
  };

  const isAuthenticated = () => currentUser !== null;
  const isAdmin = () => currentUser?.role === 'Admin';
  const isStaff = () => currentUser?.role === 'Staff';

  if (!ready) return null;

  return (
    <AuthContext.Provider value={{ currentUser, login, logout, isAuthenticated, isAdmin, isStaff }}>
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