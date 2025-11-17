import React from "react";
import Button from "@mui/material/Button";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { Routes, Route, Link } from "react-router-dom";
import styles from "./App.module.css";
import GetTeam from "./pages";
import Footer from "./components/ui/Footer";

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
          <Route
            path="/"
            element={
              <div>
                <h1>Bienvenido a RFFM</h1>
                <p>
                  Aquí podrás consultar información sobre jugadores y equipos.
                  También podrás ver estadísticas detalladas y datos relevantes.
                  Podrás ver sectorialmente cuando los equipos han recibido o
                  han marcado goles en función del minuto del partido.
                </p>
              </div>
            }
          />
          <Route path="/get-players" element={<GetTeam />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
