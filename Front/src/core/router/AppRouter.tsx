import React, { Suspense, lazy, useEffect } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { coachAuthService } from "../../apps/coach/services/authService";
import { CircularProgress, Box } from "@mui/material";
import { CoachAuthProvider } from "../../apps/coach/context/CoachAuthContext";
import RequireAuth from "./RequireAuth";

const FederationApp = lazy(() => import("../../apps/federation/routes"));
const CoachApp = lazy(() => import("../../apps/coach/routes"));
const AppSelector = lazy(() => import("./AppSelector"));
const SharedLogin = lazy(
  () => import("../../shared/components/ui/Login/Login")
);
const Error500 = lazy(
  () => import("../../shared/components/ui/Error500/Error500")
);

function LoadingFallback() {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
      }}
    >
      <CircularProgress size={60} />
    </Box>
  );
}

export default function AppRouter() {
  function RootLanding() {
    const Auth = coachAuthService.isAuthenticated();
    const Selector = AppSelector;
    const Login = SharedLogin;
    return Auth ? (
      <Selector />
    ) : (
      <CoachAuthProvider>
        <Login />
      </CoachAuthProvider>
    );
  }

  function LoginWithProvider() {
    const Login = SharedLogin;
    return (
      <CoachAuthProvider>
        <LoginRedirector>
          <Login />
        </LoginRedirector>
      </CoachAuthProvider>
    );
  }

  function LoginRedirector({ children }: { children: React.ReactNode }) {
    const navigate = useNavigate();
    // If already authenticated, redirect to root
    if (coachAuthService.isAuthenticated()) {
      navigate("/", { replace: true });
      return null;
    }
    return <>{children}</>;
  }

  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/" element={<RootLanding />} />
        <Route path="/login" element={<LoginWithProvider />} />
        {/* Backwards-compatible redirect for old statistics path */}
        <Route path="/statistics/*" element={<NavigateToFederation />} />
        <Route
          path="/federation/*"
          element={
            <RequireAuth>
              <FederationApp />
            </RequireAuth>
          }
        />
        <Route
          path="/coach/*"
          element={
            <RequireAuth>
              <CoachApp />
            </RequireAuth>
          }
        />
        <Route path="/error-500" element={<Error500 />} />
      </Routes>
    </Suspense>
  );
}

function NavigateToFederation() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/federation/goal-sectors-comparison", { replace: true });
  }, [navigate]);
  return null;
}
