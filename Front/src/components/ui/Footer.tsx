import React from "react";
import { Link, useLocation } from "react-router-dom";
import styles from "./Footer.module.css";
import IconButton from "@mui/material/IconButton";
import SvgIcon from "@mui/material/SvgIcon";

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
  return (
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
          </>
        )}
      </div>
    </div>
  );
}
