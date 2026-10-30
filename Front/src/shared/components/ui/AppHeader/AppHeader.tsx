import React, { useEffect, useRef } from "react";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import styles from "./AppHeader.module.css";
import logo from "../../../../assets/logo.png";
import Avatar from "@mui/material/Avatar";
import Badge from "@mui/material/Badge";
import GavelIcon from "@mui/icons-material/Gavel";
import SavingsIcon from "@mui/icons-material/Savings";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import { useUser } from "../../../context/UserContext";
import useAuthToken from "../../../hooks/useAuthToken";
import useMyPendingSanctionsCount from "../../../hooks/useMyPendingSanctionsCount";
import useTeamFundBalance from "../../../hooks/useTeamFundBalance";
import useQuinielaWalletBalance from "../../../hooks/useQuinielaWalletBalance";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import { useLocation, useNavigate } from "react-router-dom";
import NotificationsBell from "../NotificationsBell/NotificationsBell";
import useRootClassObserver from "../../../hooks/useRootClassObserver";
import AppVersionInfo from "../AppVersionInfo/AppVersionInfo";

const MONEY_FORMAT = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

interface AppHeaderProps {
  title?: string;
  hideIndicators?: boolean;
}

export default function AppHeader({ title, hideIndicators }: AppHeaderProps) {
  const { user, logout } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const isFederationApp = location.pathname.startsWith("/federation");
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const open = Boolean(anchorEl);
  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => setAnchorEl(null);

  const handleProfile = () => {
    handleClose();
    navigate("/profile", { state: { from: `${location.pathname}${location.search}` } });
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
      localStorage.removeItem("coach_player_teamId");
      localStorage.removeItem("rffm_user");
      // inform other parts of the app
      // emit both a logout event and an auth_expired event so all listeners
      // (including CoachAuthContext which listens for auth_expired) can react
      try {
        window.dispatchEvent(new CustomEvent("rffm.logout"));
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
  const initials =
    user?.firstName && user?.lastName
      ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
      : user?.username?.charAt(0).toUpperCase() ?? "";

  const { isAuthValid } = useAuthToken();
  const pendingSanctions = useMyPendingSanctionsCount();
  const teamFund = useTeamFundBalance();
  const quinielaWallet = useQuinielaWalletBalance();
  const pendingSanctionsLabel =
    pendingSanctions.count > 0
      ? `${pendingSanctions.count} ${
          pendingSanctions.count === 1 ? "sanción pendiente" : "sanciones pendientes"
        }`
      : "Sanciones";
  const teamFundLabel = `${teamFund.balance} €`;

  const quinielaWalletLabel = MONEY_FORMAT.format(quinielaWallet.balance ?? 0);

  const handleOpenQuinielaWallet = () => {
    navigate(
      quinielaWallet.teamId
        ? `/coach/quiniela?teamId=${encodeURIComponent(quinielaWallet.teamId)}`
        : "/coach/quiniela"
    );
  };

  const handleOpenSanctions = () => {
    navigate(
      pendingSanctions.teamId
        ? `/coach/sanctions?teamId=${pendingSanctions.teamId}`
        : "/coach/sanctions"
    );
  };

  const handleOpenTeamFund = () => {
    navigate(
      teamFund.teamId
        ? `/coach/sanctions?teamId=${teamFund.teamId}`
        : "/coach/sanctions"
    );
  };

  const displayTitle = title ?? "FUTBOL BASE";

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
          {quinielaWallet.visible && !isFederationApp && !hideIndicators && (
            <Tooltip title="Mi monedero">
              <IconButton
                onClick={handleOpenQuinielaWallet}
                size="small"
                aria-label={`Monedero: ${quinielaWalletLabel}`}
                className={styles.walletButton}
              >
                <AccountBalanceWalletIcon className={styles.walletIcon} />
                <span className={styles.walletLabel} aria-hidden="true">
                  {quinielaWalletLabel}
                </span>
              </IconButton>
            </Tooltip>
          )}
          {teamFund.visible && !isFederationApp && !hideIndicators && (
            <Tooltip title="Hucha del equipo">
              <IconButton
                onClick={handleOpenTeamFund}
                size="small"
                aria-label={`Hucha del equipo: ${teamFundLabel}`}
                className={styles.teamFundButton}
              >
                <SavingsIcon className={styles.teamFundIcon} color="success" />
                <span className={styles.teamFundLabel} aria-hidden="true">
                  {teamFundLabel}
                </span>
              </IconButton>
            </Tooltip>
          )}
          {isAuthValid && !hideIndicators && (
            <NotificationsBell key={isFederationApp ? "federation" : "coach"} app={isFederationApp ? "federation" : "coach"} />
          )}
          {pendingSanctions.visible && (
            <Tooltip title={pendingSanctionsLabel}>
              <IconButton
                onClick={handleOpenSanctions}
                size="small"
                aria-label={pendingSanctionsLabel}
              >
                <Badge
                  badgeContent={pendingSanctions.count}
                  color="error"
                  overlap="circular"
                  max={9}
                  invisible={pendingSanctions.count === 0}
                >
                  <GavelIcon className={styles.sanctionsIcon} />
                </Badge>
              </IconButton>
            </Tooltip>
          )}
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
            <AppVersionInfo />
          </Menu>
        </div>
      </Toolbar>
    </AppBar>
  );
}
