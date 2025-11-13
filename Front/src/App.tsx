import React from "react";
import Button from "@mui/material/Button";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { Routes, Route, Link } from "react-router-dom";
import styles from "./App.module.css";
import GetPlayers from "./pages";

export default function App(): JSX.Element {
  return (
    <div className={styles.app}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            RFFM App
          </Typography>
          <Button color="inherit" component={Link} to="/">
            Inicio
          </Button>
          <Button color="inherit" component={Link} to="/get-players">
            Jugadores
          </Button>
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
                  Este es un proyecto Vite + React + Material UI con CSS
                  Modules.
                </p>
                <Button variant="contained" color="primary">
                  Haz clic
                </Button>
              </div>
            }
          />
          <Route path="/get-players" element={<GetPlayers />} />
        </Routes>
      </main>
    </div>
  );
}
