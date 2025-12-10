import React from "react";
import { Navigate } from "react-router-dom";
import { coachAuthService } from "../../apps/coach/services/authService";

export default function RequireAuth({ children }: { children: JSX.Element }) {
  try {
    const ok = coachAuthService.isAuthenticated();
    if (!ok) {
      try {
        // ensure token removed and global handlers notified
        coachAuthService.logout();
        if (typeof window !== "undefined")
          window.dispatchEvent(new Event("rffm.auth_expired"));
      } catch (e) {
        // ignore
      }
      return <Navigate to="/login" replace />;
    }
    return children;
  } catch (e) {
    try {
      coachAuthService.logout();
    } catch (er) {}
    return <Navigate to="/login" replace />;
  }
}
