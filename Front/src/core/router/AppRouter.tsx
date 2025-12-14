import React, { Suspense, lazy, useEffect } from "react";
import { Routes, Route, useNavigate, Navigate } from "react-router-dom";
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
const SharedRegister = lazy(
  () => import("../../shared/pages/auth/register/Register")
);
const SharedForgot = lazy(
  () => import("../../shared/pages/auth/forgot-password/ForgotPassword")
);
const SharedReset = lazy(
  () => import("../../shared/pages/auth/reset-password/ResetPassword")
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
  function AuthMonitor() {
    const navigate = useNavigate();
    React.useEffect(() => {
      function handleAuthCheck() {
        try {
          if (!coachAuthService.isAuthenticated()) {
            try {
              coachAuthService.logout();
            } catch (e) {}
            try {
              window.dispatchEvent(new CustomEvent("rffm.auth_expired"));
            } catch (e) {}
            navigate("/login", { replace: true });
          }
        } catch (e) {}
      }

      function onVisibilityChange() {
        if (document.visibilityState === "visible") {
          handleAuthCheck();
        }
      }

      window.addEventListener("focus", handleAuthCheck);
      document.addEventListener("visibilitychange", onVisibilityChange);
      return () => {
        window.removeEventListener("focus", handleAuthCheck);
        document.removeEventListener("visibilitychange", onVisibilityChange);
      };
    }, [navigate]);
    return null;
  }
  function RootLanding() {
    const devFlag =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("dev") === "1";
    const Auth = devFlag || coachAuthService.isAuthenticated();
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
      navigate("/appSelector", { replace: true });
      return null;
    }
    return <>{children}</>;
  }

  return (
    <Suspense fallback={<LoadingFallback />}>
      <AuthMonitor />
      <Routes>
        {/* Backwards-compatible root -> appSelector redirect */}
        <Route path="/" element={<Navigate to="/appSelector" replace />} />
        <Route path="/appSelector" element={<RootLanding />} />
        <Route path="/login" element={<LoginWithProvider />} />
        <Route
          path="/register"
          element={
            <CoachAuthProvider>
              <SharedRegister />
            </CoachAuthProvider>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <CoachAuthProvider>
              <SharedForgot />
            </CoachAuthProvider>
          }
        />
        <Route
          path="/reset-password"
          element={
            <CoachAuthProvider>
              <SharedReset />
            </CoachAuthProvider>
          }
        />
        {/* Backwards-compatible redirect for old statistics path */}
        <Route path="/statistics/*" element={<NavigateToFederation />} />
        <Route
          path="/federation/*"
          element={
            <RequireAuth requiredRole="Federation">
              <FederationApp />
            </RequireAuth>
          }
        />
        <Route path="/coach/*" element={<CoachApp />} />
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
