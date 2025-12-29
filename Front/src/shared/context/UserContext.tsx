import React, { createContext, useContext, useState, useEffect } from "react";

interface User {
  id: string;
  username: string;
  email?: string;
  avatar?: string;
}

interface UserContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => void;
}

const UserContext = createContext<UserContextType | null>(null);

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

  const logout = () => {
    setUser(null);
    localStorage.removeItem("rffm_user");
    localStorage.removeItem("coachAuthToken");
    localStorage.removeItem("coachUserId");
    localStorage.removeItem("coach_roles");
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
    <UserContext.Provider value={{ user, setUser, logout }}>
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
