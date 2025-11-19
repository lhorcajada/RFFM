import React from "react";
import Button from "@mui/material/Button";
import AppHeader from "./components/ui/AppHeader/AppHeader";
import { Routes, Route, Link } from "react-router-dom";
import styles from "./App.module.css";
import { GetPlayers as GetTeam } from "./pages/Squad";
import GetCalendar from "./pages/Calendar/GetCalendar";
import Dashboard from "./pages/Dashboard/Dashboard";
import Settings from "./pages/Settings/Settings";
import Classification from "./pages/Classification";
import Footer from "./components/ui/Footer/Footer";
import Goleadores from "./pages/Goleadores/Goleadores";

export default function App(): JSX.Element {
  return (
    <div className={styles.app}>
      <main className={styles.main}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/get-players" element={<GetTeam />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/calendar" element={<GetCalendar />} />
          <Route path="/classification" element={<Classification />} />
          <Route path="/goleadores" element={<Goleadores />} />
        </Routes>
      </main>
    </div>
  );
}
