import { Navigate, useLocation } from "react-router-dom";

export default function CoachForgotPasswordWrapper() {
  const location = useLocation();
  return <Navigate to={`/forgot-password${location.search}`} replace />;
}
