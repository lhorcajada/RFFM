import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { CircularProgress, Box } from "@mui/material";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import coachTheme from "./muiCoachTheme";
import { useEffect } from "react";
import { CoachAuthProvider, CoachAuthGuard } from "./context/CoachAuthContext";

// Placeholder pages for Coach app
const Dashboard = lazy(() => import("./pages/Dashboard"));
// Auth pages are provided at top-level shared/pages/auth; coach redirects to those routes

// Feature pages for Coach app
const Settings = lazy(() => import("./pages/settings/Settings"));
const News = lazy(() => import("./pages/news/News"));
const Squad = lazy(() => import("./pages/squad/Squad"));
const Attendance = lazy(() => import("./pages/attendance/Attendance"));
const Convocations = lazy(() => import("./pages/convocations/Convocations"));
const Matches = lazy(() => import("./pages/matches/Matches"));
const Trainings = lazy(() => import("./pages/trainings/Trainings"));
const Injured = lazy(() => import("./pages/injured/Injured"));
const GameModel = lazy(() => import("./pages/game-model/GameModel"));
const Sanctions = lazy(() => import("./pages/sanctions/Sanctions"));
const Lottery = lazy(() => import("./pages/lottery/Lottery"));

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
      <CircularProgress />
    </Box>
  );
}

function CoachRoutesContent() {
  useEffect(() => {
    const prev = {
      gradient: getComputedStyle(document.documentElement).getPropertyValue(
        "--rffm-gradient-bg"
      ),
      footerBorder: getComputedStyle(document.documentElement).getPropertyValue(
        "--rffm-footer-border"
      ),
      cardBg: getComputedStyle(document.documentElement).getPropertyValue(
        "--rffm-card-bg"
      ),
      bg: getComputedStyle(document.documentElement).getPropertyValue("--bg"),
    };

    // add coach theme class to root so theme variables are scoped
    try {
      document.documentElement.classList.add("rffm-coach-theme");

      // Apply inline CSS variables on <html> so they win over :root rules
      try {
        const docElStyle = document.documentElement.style;
        docElStyle.setProperty(
          "--rffm-gradient-bg",
          "linear-gradient(180deg, #140603 0%, #2a0b06 100%)"
        );
        docElStyle.setProperty("--rffm-card-bg", "#2a0b06");
        docElStyle.setProperty(
          "--rffm-title-gradient",
          "linear-gradient(135deg, #ff8a4c 0%, #f97316 100%)"
        );
        docElStyle.setProperty("--bg", "#140603");
        docElStyle.setProperty(
          "--rffm-footer-border",
          "1px solid rgba(0,0,0,0.12)"
        );
      } catch (e) {}

      // debug: print CSS variables and computed styles for header/footer
      setTimeout(() => {
        try {
          const rootStyles = getComputedStyle(document.documentElement);
          const header = document.querySelector(
            'header[class*="MuiAppBar-root"], .appBar, header'
          );
          const footer = document.querySelector("footer, .root");
        } catch (e) {}
      }, 50);
    } catch (e) {}
    return () => {
      try {
        // remove inline variables as well
        const docElStyle = document.documentElement.style;
        docElStyle.removeProperty("--rffm-gradient-bg");
        docElStyle.removeProperty("--rffm-card-bg");
        docElStyle.removeProperty("--rffm-title-gradient");
        docElStyle.removeProperty("--bg");
        docElStyle.removeProperty("--rffm-footer-border");

        document.documentElement.classList.remove("rffm-coach-theme");
      } catch (e) {}
    };
  }, []);
  return (
    <CoachAuthGuard>
      <ThemeProvider theme={coachTheme}>
        <CssBaseline />
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<Navigate to="login" replace />} />
            <Route path="login" element={<Navigate to="/login" replace />} />
            <Route
              path="register"
              element={<Navigate to="/register" replace />}
            />
            <Route
              path="forgot-password"
              element={<Navigate to="/forgot-password" replace />}
            />
            <Route
              path="reset-password"
              element={<Navigate to="/reset-password" replace />}
            />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="settings" element={<Settings />} />
            <Route path="news" element={<News />} />
            <Route path="squad" element={<Squad />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="convocations" element={<Convocations />} />
            <Route path="matches" element={<Matches />} />
            <Route path="trainings" element={<Trainings />} />
            <Route path="injured" element={<Injured />} />
            <Route path="game-model" element={<GameModel />} />
            <Route path="sanctions" element={<Sanctions />} />
            <Route path="lottery" element={<Lottery />} />
          </Routes>
        </Suspense>
      </ThemeProvider>
    </CoachAuthGuard>
  );
}

export default function CoachRoutes() {
  return (
    <CoachAuthProvider>
      <CoachRoutesContent />
    </CoachAuthProvider>
  );
}
