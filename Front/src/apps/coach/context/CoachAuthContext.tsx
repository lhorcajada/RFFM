import React, { createContext, useState, useContext, useEffect } from "react";
import { coachAuthService } from "../services/authService";
import { useNavigate, useLocation } from "react-router-dom";
import useTempToken from "../hooks/useTempToken";
import { mapApiErrorToMessage } from "../utils/errorMessages";
import { useUser } from "../../../shared/context/UserContext";

interface CoachAuthContextType {
  isAuthenticated: boolean;
  userId: string | null;
  login: (
    username: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isSubmitting: boolean;
}

const CoachAuthContext = createContext<CoachAuthContextType | null>(null);

export const CoachAuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    coachAuthService.isAuthenticated()
  );
  const [userId, setUserId] = useState<string | null>(
    coachAuthService.getUserId()
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const { generateTempToken } = useTempToken();
  const { setUser } = useUser();

  useEffect(() => {
    function handleAuthExpired() {
      // perform logout and force redirect to login
      coachAuthService.logout();
      setIsAuthenticated(false);
      setUser(null as any);
      try {
        // try navigate if available
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
      } catch (e) {
        // ignore
      }
    }

    window.addEventListener(
      "rffm.auth_expired",
      handleAuthExpired as EventListener
    );
    return () =>
      window.removeEventListener(
        "rffm.auth_expired",
        handleAuthExpired as EventListener
      );
  }, [setUser]);

  const login = async (
    username: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    setIsSubmitting(true);
    try {
      const payload = {
        username: username,
        password: password,
      };
      const token = await generateTempToken(payload);
      const data = await coachAuthService.login(token);

      // Guardar el token en localStorage
      localStorage.setItem("coachAuthToken", data.token || data);

      // Decodificar el JWT para extraer userId
      const tokenStr = data.token || data;
      const tokenParser = JSON.parse(atob(tokenStr.split(".")[1]));
      const extractedUserId =
        tokenParser[
          "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
        ] || tokenParser.sub;

      localStorage.setItem("coachUserId", extractedUserId);

      // Actualizar estado
      setIsAuthenticated(true);
      setUserId(extractedUserId);

      // Guardar usuario en contexto global y localStorage
      const userData = {
        id: extractedUserId,
        username: username,
      };
      setUser(userData);
      localStorage.setItem("rffm_user", JSON.stringify(userData));

      return { success: true };
    } catch (error: any) {
      console.error(error);
      setIsAuthenticated(false);
      setUserId(null);

      const errorMessage = mapApiErrorToMessage(error);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setIsSubmitting(false);
    }
  };

  const logout = () => {
    coachAuthService.logout();
    setIsAuthenticated(false);
    setUserId(null);
  };

  return (
    <CoachAuthContext.Provider
      value={{ isAuthenticated, userId, login, logout, isSubmitting }}
    >
      {children}
    </CoachAuthContext.Provider>
  );
};

export const useCoachAuthContext = (): CoachAuthContextType => {
  const context = useContext(CoachAuthContext);
  if (!context) {
    throw new Error(
      "useCoachAuthContext debe usarse dentro de un CoachAuthProvider"
    );
  }
  return context;
};

// Componente para manejar la lógica de redirección
export const CoachAuthGuard: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useCoachAuthContext();

  useEffect(() => {
    const publicRoutes = [
      "/coach/login",
      "/login",
      "/coach/register",
      "/coach/forgot-password",
      "/coach/reset-password",
    ];
    const isPublicRoute = publicRoutes.some((route) =>
      location.pathname.startsWith(route)
    );

    if (!isAuthenticated && !isPublicRoute) {
      navigate("/login", { replace: true });
    }
  }, [location.pathname, navigate, isAuthenticated]);

  return <>{children}</>;
};
