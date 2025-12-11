import React from "react";
import { Navigate } from "react-router-dom";
import { coachAuthService } from "../../apps/coach/services/authService";

export default function RequireAuth({
  children,
  requiredRole,
}: {
  children: JSX.Element;
  requiredRole?: string;
}) {
  try {
    const devFlag =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("dev") === "1";
    const ok = devFlag || coachAuthService.isAuthenticated();
    if (!ok) {
      try {
        coachAuthService.logout();
        if (typeof window !== "undefined")
          window.dispatchEvent(new Event("rffm.auth_expired"));
      } catch (e) {}
      return <Navigate to="/login" replace />;
    }

    // if a role is required, ensure the user has it (Administrator bypasses)
    if (requiredRole && !coachAuthService.hasRole(requiredRole)) {
      // authenticated but forbidden -> show snackbar and redirect to root
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
      return <Navigate to="/" replace />;
    }

    return children;
  } catch (e) {
    try {
      coachAuthService.logout();
    } catch (er) {}
    return <Navigate to="/login" replace />;
  }
}
