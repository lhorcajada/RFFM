import React from "react";
import { Link, useLocation } from "react-router-dom";
import styles from "./Footer.module.css";
import IconButton from "@mui/material/IconButton";
import SvgIcon from "@mui/material/SvgIcon";

export default function Footer(): JSX.Element {
  const loc = useLocation();
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
      </div>
    </div>
  );
}
