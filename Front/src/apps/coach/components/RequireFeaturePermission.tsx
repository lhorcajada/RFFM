import React, { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import { usePermissions } from "../../../shared/hooks/usePermissions";
import { useIsPlayerRole } from "../hooks/useIsPlayerRole";

interface RequireFeaturePermissionProps {
  featureRoute: string;
  children: React.ReactNode;
  allowPlayerAccess?: boolean;
  /** Where to redirect when access is denied. Defaults to the general Coach dashboard. */
  redirectTo?: string;
}

/**
 * Route guard that blocks direct URL navigation to a Coach-app page whose feature route
 * is not present in the caller's permissions (see GET /api/permissions/me). Mirrors the
 * backend's FeaturePermissionBehavior 403 semantics on the frontend: a role without a
 * matching FeaturePermission row cannot reach the page's content, only see it redirected.
 */
export const RequireFeaturePermission: React.FC<RequireFeaturePermissionProps> = ({
  featureRoute,
  children,
  allowPlayerAccess = true,
  redirectTo = "/coach/dashboard",
}) => {
  const { loading, hasFeatureAccess } = usePermissions();
  const isPlayer = useIsPlayerRole();
  const allowed = hasFeatureAccess(featureRoute) && (allowPlayerAccess || !isPlayer);

  useEffect(() => {
    if (!loading && !allowed) {
      try {
        window.dispatchEvent(
          new CustomEvent("rffm.show_snackbar", {
            detail: {
              message: "No tienes permiso para acceder a esta sección.",
              severity: "warning",
            },
          }),
        );
      } catch {
        // no-op: event bus is best-effort
      }
    }
  }, [loading, allowed]);

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "50vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!allowed) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};

export default RequireFeaturePermission;
