import React from "react";
import Button from "@mui/material/Button";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { Routes, Route, Link } from "react-router-dom";
import styles from "./App.module.css";
import { GetPlayers as GetTeam } from "./pages/Squad";
import GetCalendar from "./pages/Calendar/GetCalendar";
import Dashboard from "./pages/Dashboard/Dashboard";
import Settings from "./pages/Settings/Settings";
import Footer from "./components/ui/Footer/Footer";

export default function App(): JSX.Element {
  return (
    <div className={styles.app}>
      <AppBar
        position="static"
        sx={{ background: "linear-gradient(180deg, #082033 0%, #05313b 100%)" }}
      >
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            RFFM App
          </Typography>
          {/* header buttons moved to footer */}
        </Toolbar>
      </AppBar>

      <main className={styles.main}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/get-players" element={<GetTeam />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/calendar" element={<GetCalendar />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
