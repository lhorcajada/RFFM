import React from "react";
import Button from "@mui/material/Button";
import AppHeader from "./components/ui/AppHeader/AppHeader";
import { Routes, Route, Link, useNavigate } from "react-router-dom";
import styles from "./App.module.css";
import { GetPlayers as GetTeam } from "./pages/Squad";
import GetCalendar from "./pages/Calendar/GetCalendar";
import Dashboard from "./pages/Dashboard/Dashboard";
import Settings from "./pages/Settings/Settings";
import SavedConfigsPage from "./pages/SavedConfigs/SavedConfigs";
import Classification from "./pages/Classification";
import Footer from "./components/ui/Footer/Footer";
import Goleadores from "./pages/Goleadores/Goleadores";
import Acta from "./pages/Acta/Acta";
import Error500 from "./pages/Error500/Error500";
import Statistics from "./pages/Statistics/Statistics";
import GoalSectorsComparison from "./pages/Statistics/GoalSectorsComparison";
import CallupsPage from "./pages/Callups/Callups";
import { registerNavigate } from "./services/api";

export default function App(): JSX.Element {
  const navigate = useNavigate();
  React.useEffect(() => {
    registerNavigate((p) => navigate(p));
  }, [navigate]);
  return (
    <div className={styles.app}>
      <main className={styles.main}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/get-players" element={<GetTeam />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/saved-configs" element={<SavedConfigsPage />} />
          <Route path="/calendar" element={<GetCalendar />} />
          <Route path="/classification" element={<Classification />} />
          <Route path="/goleadores" element={<Goleadores />} />
          <Route path="/statistics" element={<Statistics />} />
          <Route
            path="/statistics/goal-sectors-comparison"
            element={<GoalSectorsComparison />}
          />
          <Route path="/acta/:codacta" element={<Acta />} />
          <Route path="/callups" element={<CallupsPage />} />
          <Route path="/error-500" element={<Error500 />} />
        </Routes>
      </main>
    </div>
  );
}
