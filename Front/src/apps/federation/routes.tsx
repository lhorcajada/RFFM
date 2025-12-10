import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { CircularProgress, Box } from "@mui/material";

// Lazy load pages
const Dashboard = lazy(() => import("./pages/Dashboard/Dashboard"));
const Calendar = lazy(() => import("./pages/Calendar/GetCalendar"));
const Classification = lazy(
  () => import("./pages/Classification/Classification")
);
const Squad = lazy(() => import("./pages/Squad/GetPlayers"));
const Acta = lazy(() => import("./pages/Acta/Acta"));
const Goleadores = lazy(() => import("./pages/Goleadores/Goleadores"));
const Matchday = lazy(() => import("./pages/Matchday/Matchday"));
const Callups = lazy(() => import("./pages/Callups/Callups"));
const Settings = lazy(() => import("./pages/Settings/Settings"));
const SavedConfigs = lazy(() => import("./pages/SavedConfigs/SavedConfigs"));
const Statistics = lazy(() => import("./pages/Statistics/Statistics"));
const GoalSectorsComparison = lazy(
  () => import("./pages/Statistics/GoalSectorsComparison")
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
      <CircularProgress />
    </Box>
  );
}

export default function FederationRoutes() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/" element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="classification" element={<Classification />} />
        <Route path="get-players" element={<Squad />} />
        <Route path="acta/:codacta" element={<Acta />} />
        <Route path="goleadores" element={<Goleadores />} />
        <Route path="callups" element={<Callups />} />
        <Route path="matchday" element={<Matchday />} />
        <Route path="settings" element={<Settings />} />
        <Route path="saved-configs" element={<SavedConfigs />} />
        <Route path="statistics" element={<Statistics />} />
        <Route
          path="goal-sectors-comparison"
          element={<GoalSectorsComparison />}
        />
        <Route path="error500" element={<Error500 />} />
      </Routes>
    </Suspense>
  );
}
