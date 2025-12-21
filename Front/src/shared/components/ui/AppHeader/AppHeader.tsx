import React, { useEffect, useRef } from "react";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import styles from "./AppHeader.module.css";
import logo from "../../../../assets/logo.png";
import Avatar from "@mui/material/Avatar";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import { useUser } from "../../../context/UserContext";
import useAuthToken from "../../../hooks/useAuthToken";
import { useNavigate } from "react-router-dom";
import useRootClassObserver from "../../../hooks/useRootClassObserver";

interface AppHeaderProps {
  title?: string;
}

export default function AppHeader({ title }: AppHeaderProps) {
  const { user, logout } = useUser();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const open = Boolean(anchorEl);
  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => setAnchorEl(null);

  const handleProfile = () => {
    handleClose();
    try {
      window.dispatchEvent(
        new CustomEvent("rffm.show_snackbar", {
          detail: {
            message: "Perfil no disponible todavía.",
            severity: "info",
          },
        })
      );
    } catch (e) {}
  };

  const handleSettings = () => {
    handleClose();
    navigate("/federation/settings");
  };

  const handleLogout = () => {
    handleClose();
    try {
      // ensure all auth-related keys are removed
      localStorage.removeItem("coachAuthToken");
      localStorage.removeItem("coachUserId");
      localStorage.removeItem("coach_roles");
      localStorage.removeItem("rffm_user");
      // inform other parts of the app
      // emit both a logout event and an auth_expired event so all listeners
      // (including CoachAuthContext which listens for auth_expired) can react
      try {
        window.dispatchEvent(new CustomEvent("rffm.logout"));
      } catch (e) {}
      try {
        window.dispatchEvent(new CustomEvent("rffm.auth_expired"));
      } catch (e) {}
    } catch (e) {}
    // also call context logout to clear state
    try {
      logout();
    } catch (e) {}
    try {
      window.dispatchEvent(
        new CustomEvent("rffm.show_snackbar", {
          detail: { message: "Sesión cerrada.", severity: "success" },
        })
      );
    } catch (e) {}
    navigate("/login");
  };

  const avatarSrc = user?.avatar || undefined;
  const initials = user ? user.username?.charAt(0).toUpperCase() : "";

  const { isAuthValid } = useAuthToken();

  const displayTitle = title ?? "Futbol Base";

  const appBarRef = useRef<HTMLDivElement | null>(null);

  function applyRootClassStyles(el: HTMLElement | null, enabled: boolean) {
    if (!el) return;
    if (enabled) {
      el.style.setProperty(
        "background",
        "var(--rffm-gradient-bg)",
        "important"
      );
      el.style.setProperty("box-shadow", "none", "important");
      el.style.setProperty(
        "border-bottom",
        "1px solid rgba(0,0,0,0.12)",
        "important"
      );
    } else {
      el.style.removeProperty("background");
      el.style.removeProperty("box-shadow");
      el.style.removeProperty("border-bottom");
    }
  }

  // observe root html class changes for coach theme and apply styles
  useRootClassObserver("rffm-coach-theme", (enabled) => {
    let el = appBarRef.current as HTMLElement | null;
    if (!el) {
      try {
        el = document.querySelector(`.${styles.appBar}`) as HTMLElement | null;
      } catch (e) {
        el = null;
      }
    }
    applyRootClassStyles(el, enabled);
  });

  return (
    <AppBar
      ref={appBarRef}
      position="static"
      className={styles.appBar}
      color="transparent"
    >
      <Toolbar className={styles.toolbar}>
        <div className={styles.brand}>
          <img src={logo} alt={displayTitle} className={styles.brandLogo} />
          <Typography
            variant="h6"
            component="div"
            className={`${styles.appName} ${title ? styles.hasAppTitle : ""}`}
          >
            {displayTitle}
          </Typography>
        </div>

        <div className={styles.userBox}>
          <IconButton
            onClick={handleOpen}
            size="small"
            aria-controls={open ? "user-menu" : undefined}
            aria-haspopup="true"
            aria-expanded={open ? "true" : undefined}
            aria-label={
              user?.username
                ? `Abrir menú de ${user.username}`
                : "Abrir menú de usuario"
            }
          >
            <Avatar
              src={avatarSrc}
              className={`${styles.avatar} ${
                isAuthValid ? styles.avatarValid : styles.avatarInvalid
              }`}
            >
              {!avatarSrc && initials}
            </Avatar>
          </IconButton>
          {/* Username display removed per design: only avatar shown */}
          <Menu
            id="user-menu"
            anchorEl={anchorEl}
            open={open}
            onClose={handleClose}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
          >
            <MenuItem onClick={handleProfile}>Perfil</MenuItem>
            <MenuItem onClick={handleLogout}>Cerrar sesión</MenuItem>
          </Menu>
        </div>
      </Toolbar>
    </AppBar>
  );
}
