import React, { useCallback, useEffect, useState } from "react";
import Badge from "@mui/material/Badge";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import NotificationsIcon from "@mui/icons-material/Notifications";
import { useNavigate } from "react-router-dom";
import {
  markNotificationRead,
  searchNotifications,
  type NotificationResponse,
} from "../../../services/notificationService";
import styles from "./FederationNotificationsBell.module.css";

const PAGE_SIZE = 20;
const REFRESH_INTERVAL_MS = 60_000;

function unreadLabel(count: number): string {
  if (count === 0) return "Notificaciones";
  return count === 1 ? "1 notificación sin leer" : `${count} notificaciones sin leer`;
}

export default function FederationNotificationsBell(): JSX.Element {
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationResponse[]>([]);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await searchNotifications(1, PAGE_SIZE, { suppressErrorRedirect: true });
      setItems(result.items ?? []);
    } catch {
      // la campana no debe romper la cabecera si falla la carga
    }
  }, []);

  useEffect(() => {
    load();
    const interval = window.setInterval(load, REFRESH_INTERVAL_MS);
    window.addEventListener("focus", load);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", load);
    };
  }, [load]);

  const unreadCount = items.filter((n) => !n.isRead).length;
  const label = unreadLabel(unreadCount);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    load();
  };

  const handleSelect = async (notification: NotificationResponse) => {
    setAnchorEl(null);
    if (!notification.isRead) {
      setItems((prev) => prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)));
      try {
        await markNotificationRead(notification.id);
      } catch {
        // si falla, se volverá a mostrar como no leída en la siguiente recarga
      }
    }
    if (notification.deepLinkPath) navigate(notification.deepLinkPath);
  };

  return (
    <>
      <Tooltip title={label}>
        <IconButton onClick={handleOpen} size="small" aria-label={label}>
          <Badge
            badgeContent={unreadCount}
            color="error"
            overlap="circular"
            max={9}
            invisible={unreadCount === 0}
          >
            <NotificationsIcon className={styles.icon} />
          </Badge>
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { className: styles.menuPaper } }}
      >
        {items.length === 0 ? (
          <MenuItem disabled>
            <Typography variant="body2">No tienes notificaciones</Typography>
          </MenuItem>
        ) : (
          items.map((n) => (
            <MenuItem
              key={n.id}
              onClick={() => handleSelect(n)}
              className={`${styles.item} ${n.isRead ? "" : styles.unread}`}
            >
              <span className={styles.title}>{n.title}</span>
              <span className={styles.body}>{n.body}</span>
            </MenuItem>
          ))
        )}
      </Menu>
    </>
  );
}
