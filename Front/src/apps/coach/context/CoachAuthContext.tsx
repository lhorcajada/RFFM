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
  useEffect(() => {
    function handleCoachTokenUpdated(ev: Event) {
      try {
        const custom = ev as CustomEvent<any>;
        const detail = custom?.detail ?? {};
        console.debug(
          "CoachAuthContext: received rffm.coach_token_updated",
          detail
        );

        // If roles are provided, cache them so coachAuthService can read them
        if (Array.isArray(detail.roles)) {
          try {
            localStorage.setItem("coach_roles", JSON.stringify(detail.roles));
          } catch (e) {
            // ignore
          }
        }

        // Update auth state from token (coachAuthService reads localStorage)
        const nowAuth = coachAuthService.isAuthenticated();
        const nowUserId = coachAuthService.getUserId();
        setIsAuthenticated(nowAuth);
        setUserId(nowUserId);
        console.log(
          "CoachAuthContext: received rffm.coach_token_updated",
          detail
        );
        console.debug(
          "CoachAuthContext: received rffm.coach_token_updated",
          detail
        );
      } catch (e) {
        // ignore
      }
    }
    window.addEventListener(
      "rffm.coach_token_updated",
      handleCoachTokenUpdated as EventListener
    );
    return () =>
      window.removeEventListener(
        "rffm.coach_token_updated",
        handleCoachTokenUpdated as EventListener
      );
  }, []);

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

      // Emit a global event and as a robust fallback force a full-page redirect
      try {
        window.dispatchEvent(
          new CustomEvent("rffm.login_success", { detail: { user: userData } })
        );
      } catch (e) {}

      try {
        if (typeof window !== "undefined") {
          window.location.href = "/appSelector";
        }
      } catch (e) {}

      return { success: true };
    } catch (error: any) {
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
      "/login",
      "/register",
      "/forgot-password",
      "/reset-password",
    ];
    const isPublicRoute = publicRoutes.some((route) =>
      location.pathname.startsWith(route)
    );

    if (!isAuthenticated && !isPublicRoute) {
      navigate("/login", { replace: true });
      return;
    }

    // If authenticated, ensure user has Coach role to access coach area
    // Do not redirect away from public routes (login/register/forgot/reset)
    if (isAuthenticated && !isPublicRoute) {
      // Wait for roles to become available. Use either the token-updated event
      // or polling for a short period to avoid premature redirect due to timing.
      let cancelled = false;
      const eventHandler = () => {
        // noop; presence of event will speed up re-evaluation in the loop below
      };
      window.addEventListener(
        "rffm.coach_token_updated",
        eventHandler as EventListener
      );

      const checkRole = async () => {
        const start = Date.now();
        const timeout = 3000; // ms
        while (Date.now() - start < timeout && !cancelled) {
          try {
            if (coachAuthService.hasRole("Coach")) {
              window.removeEventListener(
                "rffm.coach_token_updated",
                eventHandler as EventListener
              );
              return;
            }
          } catch (e) {}
          // small delay; this allows the event listener to fire and localStorage
          // to be visible to this execution context
          await new Promise((r) => setTimeout(r, 100));
        }

        window.removeEventListener(
          "rffm.coach_token_updated",
          eventHandler as EventListener
        );

        if (!cancelled && !coachAuthService.hasRole("Coach")) {
          try {
            window.dispatchEvent(
              new CustomEvent("rffm.show_snackbar", {
                detail: {
                  message:
                    "No tienes permisos para acceder a la sección de Entrenadores.",
                  severity: "warning",
                },
              })
            );
          } catch (e) {}
          navigate("/", { replace: true });
        }
      };

      checkRole();
      return () => {
        cancelled = true;
        try {
          window.removeEventListener(
            "rffm.coach_token_updated",
            eventHandler as EventListener
          );
        } catch (e) {}
      };
    }
  }, [location.pathname, navigate, isAuthenticated]);

  return <>{children}</>;
};
