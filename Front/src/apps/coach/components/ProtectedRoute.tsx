import React from "react";
import { Navigate } from "react-router-dom";
import { useCoachAuthContext } from "../context/CoachAuthContext";
import { Box, CircularProgress } from "@mui/material";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated } = useCoachAuthContext();

  if (!isAuthenticated) {
    return <Navigate to="/coach/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
