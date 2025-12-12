import { Navigate, useLocation } from "react-router-dom";

export default function CoachResetPasswordWrapper() {
  const location = useLocation();
  return <Navigate to={`/reset-password${location.search}`} replace />;
}
