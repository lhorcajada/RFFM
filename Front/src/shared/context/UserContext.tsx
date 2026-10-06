import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getMyAccount } from "../services/profile/profileService";

interface User {
  id: string;
  username: string;
  email?: string;
  avatar?: string;
  firstName?: string;
  lastName?: string;
}

interface UserContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => void;
  refreshAccount: () => Promise<void>;
}

const UserContext = createContext<UserContextType | null>(null);

function persistUser(user: User | null) {
  try {
    if (user) localStorage.setItem("rffm_user", JSON.stringify(user));
  } catch (e) {
    // ignore
  }
}

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const storedUser = localStorage.getItem("rffm_user");
      if (storedUser) return JSON.parse(storedUser) as User;
    } catch (e) {
      // ignore
    }
    return null;
  });

  const refreshAccount = useCallback(async () => {
    try {
      const account = await getMyAccount();
      setUser((prev) => {
        if (!prev) return prev;
        const next: User = {
          ...prev,
          avatar: account.avatarUrl ?? undefined,
          firstName: account.firstName ?? undefined,
          lastName: account.lastName ?? undefined,
        };
        persistUser(next);
        return next;
      });
    } catch (e) {
      // la cabecera cae a las iniciales del alias
    }
  }, []);

  const userId = user?.id;
  useEffect(() => {
    let hasToken = false;
    try {
      hasToken = !!localStorage.getItem("coachAuthToken");
    } catch (e) {
      hasToken = false;
    }
    if (userId && hasToken) void refreshAccount();
  }, [userId, refreshAccount]);

  const logout = () => {
    setUser(null);
    localStorage.removeItem("rffm_user");
    localStorage.removeItem("coachAuthToken");
    localStorage.removeItem("coachUserId");
    localStorage.removeItem("coach_roles");
    localStorage.removeItem("coach_player_teamId");
    try {
      if (typeof window !== "undefined") {
        const path = window.location?.pathname ?? "";
        const publicPrefixes = [
          "/login",
          "/register",
          "/forgot-password",
          "/reset-password",
        ];
        if (!publicPrefixes.some((p) => path.startsWith(p))) {
          window.dispatchEvent(new CustomEvent("rffm.auth_expired"));
        }
      }
    } catch (e) {}
  };

  return (
    <UserContext.Provider value={{ user, setUser, logout, refreshAccount }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser debe ser usado dentro de UserProvider");
  }
  return context;
};
