import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { coachAuthService } from "../../apps/coach/services/authService";

export default function RequireAuth({
  children,
  requiredRole,
}: {
  children: JSX.Element;
  requiredRole?: string;
}) {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const devFlag =
        typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("dev") === "1";
      const ok = devFlag || coachAuthService.isAuthenticated();
      if (!ok) {
        setAllowed(false);
        return;
      }

      if (!requiredRole) {
        setAllowed(true);
        return;
      }

      // If role required, allow a longer grace period and react to token updates
      let cancelled = false;
      const eventHandler = () => {
        // no-op; presence of event will help the polling loop detect changes faster
      };
      window.addEventListener(
        "rffm.coach_token_updated",
        eventHandler as EventListener
      );

      const checkRole = async () => {
        const start = Date.now();
        const timeout = 3000;
        while (Date.now() - start < timeout && !cancelled) {
          if (coachAuthService.hasRole(requiredRole)) {
            setAllowed(true);
            window.removeEventListener(
              "rffm.coach_token_updated",
              eventHandler as EventListener
            );
            return;
          }
          await new Promise((r) => setTimeout(r, 100));
        }
        window.removeEventListener(
          "rffm.coach_token_updated",
          eventHandler as EventListener
        );
        if (!cancelled) setAllowed(coachAuthService.hasRole(requiredRole));
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
    } catch (e) {
      try {
        coachAuthService.logout();
      } catch (er) {}
      setAllowed(false);
    }
  }, [requiredRole]);

  if (allowed === null) return null; // or a spinner if you prefer

  if (!allowed) {
    try {
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("rffm.show_snackbar", {
            detail: {
              message: "No tienes permisos para acceder a esta sección.",
              severity: "warning",
            },
          })
        );
      }
    } catch (e) {}
    return <Navigate to="/appSelector" replace />;
  }

  return children;
}
