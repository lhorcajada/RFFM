import { Navigate, useLocation } from "react-router-dom";

export default function CoachRegisterWrapper() {
  const location = useLocation();
  return <Navigate to={`/register${location.search}`} replace />;
}
