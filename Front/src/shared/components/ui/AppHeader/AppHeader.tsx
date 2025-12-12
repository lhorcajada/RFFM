import React from "react";
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
import { useNavigate } from "react-router-dom";

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
      localStorage.removeItem("rffm_user");
      // inform other parts of the app
      window.dispatchEvent(new CustomEvent("rffm.logout"));
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

  const displayTitle = title ?? "Futbol Base";

  return (
    <AppBar position="static" className={styles.appBar} color="transparent">
      <Toolbar className={styles.toolbar}>
        <div className={styles.brand}>
          <img src={logo} alt={displayTitle} className={styles.brandLogo} />
          <Typography variant="h6" component="div" className={styles.appName}>
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
          >
            <Avatar src={avatarSrc}>{!avatarSrc && initials}</Avatar>
          </IconButton>
          {user?.username && (
            <Tooltip title={user.username} arrow disableInteractive>
              <div
                className={styles.userName}
                aria-hidden
                title={user.username}
              >
                {user.username}
              </div>
            </Tooltip>
          )}
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
