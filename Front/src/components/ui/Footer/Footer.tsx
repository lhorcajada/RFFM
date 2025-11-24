import React from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import styles from "./Footer.module.css";
import IconButton from "@mui/material/IconButton";
import SvgIcon from "@mui/material/SvgIcon";
import SettingsIcon from "@mui/icons-material/Settings";

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
              to="/calendar"
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
              to="/saved-configs"
              className={
                loc.pathname.startsWith("/saved-configs")
                  ? `${styles.iconBtn} ${styles.active}`
                  : styles.iconBtn
              }
              aria-label="Combinaciones"
              size="large"
            >
              <SettingsIcon />
            </IconButton>
          </>
        )}
      </div>
    </div>
  );

  if (typeof document !== "undefined" && document.body) {
    return createPortal(footer, document.body);
  }

  return footer;
}
