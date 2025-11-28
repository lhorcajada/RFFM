import React from "react";
import { Link, useLocation } from "react-router-dom";
import styles from "./Footer.module.css";
import IconButton from "@mui/material/IconButton";
import SvgIcon from "@mui/material/SvgIcon";
import SettingsIcon from "@mui/icons-material/Settings";
import HowToRegIcon from "@mui/icons-material/HowToReg";

export default function Footer(): JSX.Element {
  const loc = useLocation();
  // reactive showActions state so Footer updates when localStorage changes
  const [showActions, setShowActions] = React.useState<boolean>(() => {
    try {
      const raw = localStorage.getItem("rffm.saved_combinations_v1");
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) && arr.length > 0;
    } catch (e) {
      return false;
    }
  });

  React.useEffect(() => {
    function handle() {
      try {
        const raw = localStorage.getItem("rffm.saved_combinations_v1");
        const arr = raw ? JSON.parse(raw) : [];
        setShowActions(Array.isArray(arr) && arr.length > 0);
      } catch (e) {
        setShowActions(false);
      }
    }
    window.addEventListener("rffm.saved_combinations_changed", handle);
    // also listen to storage events in case other tabs modify storage
    window.addEventListener("storage", handle);
    return () => {
      window.removeEventListener("rffm.saved_combinations_changed", handle);
      window.removeEventListener("storage", handle);
    };
  }, []);
  const footer = (
    <div className={styles.root} role="contentinfo">
      <div className={styles.bar}>
        <IconButton
          component={Link}
          to="/"
          className={
            loc.pathname === "/"
              ? `${styles.iconBtn} ${styles.active}`
              : styles.iconBtn
          }
          aria-label="Inicio"
          size="large"
        >
          <SvgIcon>
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
          </SvgIcon>
        </IconButton>

        {showActions && (
          <>
            <IconButton
              component={Link}
              to="/get-players"
              className={
                loc.pathname.startsWith("/get")
                  ? `${styles.iconBtn} ${styles.active}`
                  : styles.iconBtn
              }
              aria-label="Equipos"
              size="large"
            >
              <SvgIcon>
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C12 14.17 7.33 13 5 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 2.06 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-6-3.5z" />
              </SvgIcon>
            </IconButton>

            <IconButton
              component={Link}
              to={{ pathname: "/calendar", state: { resetToCurrent: true } }}
              className={
                loc.pathname.startsWith("/calendar")
                  ? `${styles.iconBtn} ${styles.active}`
                  : styles.iconBtn
              }
              aria-label="Calendario"
              size="large"
            >
              <SvgIcon>
                <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11zM7 11h5v5H7z" />
              </SvgIcon>
            </IconButton>
            <IconButton
              component={Link}
              to="/classification"
              className={
                loc.pathname.startsWith("/classification")
                  ? `${styles.iconBtn} ${styles.active}`
                  : `${styles.iconBtn} ${styles.classificationBtn}`
              }
              aria-label="Clasificación"
              size="large"
            >
              <SvgIcon>
                <path d="M12 2L2 7v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7l-10-5zM7 18H5v-6h2v6zm6 0h-2v-8h2v8zm6 0h-2v-4h2v4z" />
              </SvgIcon>
            </IconButton>
            <IconButton
              component={Link}
              to="/goleadores"
              className={
                loc.pathname.startsWith("/goleadores")
                  ? `${styles.iconBtn} ${styles.active}`
                  : styles.iconBtn
              }
              aria-label="Goleadores"
              size="large"
            >
              <SvgIcon>
                {/* Trophy icon */}
                <path d="M17 4V2H7v2H2v2c0 3.53 2.61 6.43 6 6.92V17H8v2h8v-2h-1v-4.08c3.39-.49 6-3.39 6-6.92V4h-5zm-7 0h6v2H10V4zm9 2c0 2.97-2.16 5.43-5 5.92V6h5zm-7 5.92C6.16 11.43 4 8.97 4 6h5v5.92z" />
              </SvgIcon>
            </IconButton>
            <IconButton
              component={Link}
              to="/callups"
              className={
                loc.pathname.startsWith("/callups")
                  ? `${styles.iconBtn} ${styles.active}`
                  : styles.iconBtn
              }
              aria-label="Convocatorias"
              size="large"
            >
              <SvgIcon>
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" />
              </SvgIcon>
            </IconButton>
            <IconButton
              component={Link}
              to="/statistics"
              className={
                loc.pathname.startsWith("/statistics")
                  ? `${styles.iconBtn} ${styles.active}`
                  : styles.iconBtn
              }
              aria-label="Estadísticas"
              size="large"
            >
              <SvgIcon>
                <path d="M3 13h2v6H3v-6zm4-8h2v14H7V5zm4 6h2v8h-2v-8zm4-4h2v12h-2V7zm4-6h2v18h-2V1z" />
              </SvgIcon>
            </IconButton>
            <IconButton
              component={Link}
              to="/settings"
              className={
                loc.pathname.startsWith("/settings")
                  ? `${styles.iconBtn} ${styles.active}`
                  : styles.iconBtn
              }
              aria-label="Configuración"
              size="large"
            >
              <SvgIcon>
                <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.63l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.007 7.007 0 0 0-1.6-.94l-.36-2.54A.5.5 0 0 0 14 2h-4a.5.5 0 0 0-.49.42l-.36 2.54c-.58.22-1.12.52-1.6.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.9a.5.5 0 0 0 .12.63l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.83 15.6a.5.5 0 0 0-.12.63l1.92 3.32c.14.24.43.34.68.24l2.39-.96c.48.42 1.02.72 1.6.94l.36 2.54c.05.27.28.46.54.46h4c.26 0 .49-.19.54-.46l.36-2.54c.58-.22 1.12-.52 1.6-.94l2.39.96c.25.1.54 0 .68-.24l1.92-3.32a.5.5 0 0 0-.12-.63l-2.03-1.58zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z" />
              </SvgIcon>
            </IconButton>
          </>
        )}
      </div>
    </div>
  );

  return footer;
}
