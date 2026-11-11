import { Navigate, useLocation } from "react-router-dom";

export default function RedirectKeepingSearch(props: { to: string }) {
  const { search } = useLocation();
  return <Navigate to={{ pathname: props.to, search }} replace />;
}
