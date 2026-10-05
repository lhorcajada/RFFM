import React, { useCallback, useEffect, useState } from "react";
import Badge from "@mui/material/Badge";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import NotificationsIcon from "@mui/icons-material/Notifications";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import { useNavigate } from "react-router-dom";
import {
  markAllNotificationsRead,
  markNotificationRead,
  NOTIFICATIONS_CHANGED_EVENT,
  searchNotifications,
  type NotificationApp,
  type NotificationResponse,
} from "../../../services/notificationService";
import styles from "./NotificationsBell.module.css";

const PAGE_SIZE = 20;
const REFRESH_INTERVAL_MS = 60_000;

type NotificationsBellProps = {
  app: NotificationApp;
};

function unreadLabel(count: number): string {
  if (count === 0) return "Notificaciones";
  return count === 1 ? "1 notificación sin leer" : `${count} notificaciones sin leer`;
}

export default function NotificationsBell({ app }: NotificationsBellProps): JSX.Element {
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationResponse[]>([]);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await searchNotifications(1, PAGE_SIZE, { suppressErrorRedirect: true, app });
      setItems(result.items ?? []);
    } catch {
      // la campana no debe romper la cabecera si falla la carga
    }
  }, [app]);

  useEffect(() => {
    load();
    const interval = window.setInterval(load, REFRESH_INTERVAL_MS);
    window.addEventListener("focus", load);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, load);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", load);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, load);
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

  const handleMarkAllRead = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await markAllNotificationsRead(app);
      window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT));
    } catch {
      load();
    }
  };

  const menuContent: React.ReactNode[] = [];
  if (unreadCount > 0) {
    menuContent.push(
      <MenuItem key="mark-all" onClick={handleMarkAllRead} className={styles.markAll}>
        <DoneAllIcon fontSize="small" />
        &nbsp;Marcar todas como leídas
      </MenuItem>,
      <Divider key="mark-all-divider" />,
    );
  }
  if (items.length === 0) {
    menuContent.push(
      <MenuItem key="empty" disabled>
        <Typography variant="body2">No tienes notificaciones</Typography>
      </MenuItem>,
    );
  } else {
    items.forEach((n) =>
      menuContent.push(
        <MenuItem
          key={n.id}
          onClick={() => handleSelect(n)}
          className={`${styles.item} ${n.isRead ? "" : styles.unread}`}
        >
          <span className={styles.title}>{n.title}</span>
          <span className={styles.body}>{n.body}</span>
        </MenuItem>,
      ),
    );
  }

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
        {menuContent}
      </Menu>
    </>
  );
}
