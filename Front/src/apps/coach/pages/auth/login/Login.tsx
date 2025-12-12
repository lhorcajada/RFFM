import { Navigate, useLocation } from "react-router-dom";

export default function CoachLoginWrapper() {
  const location = useLocation();
  return <Navigate to={`/login${location.search}`} replace />;
}
