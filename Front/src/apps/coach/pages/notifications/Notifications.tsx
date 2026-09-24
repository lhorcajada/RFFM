import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Chip,
  Pagination,
  Stack,
  Typography,
} from "@mui/material";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import { useAuditPageAccess } from "../../../../shared/hooks/useAuditPageAccess";
import NotificationSettings from "../settings/components/NotificationSettings/NotificationSettings";
import {
  searchNotifications,
  markNotificationRead,
  type NotificationResponse,
} from "../../services/notificationService";
import styles from "./Notifications.module.css";

const PAGE_SIZE = 25;

const Notifications: React.FC = () => {
  useAuditPageAccess("Notifications");
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<NotificationResponse[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await searchNotifications(pageNumber, PAGE_SIZE);
        if (cancelled) return;
        setItems(result.items);
        setTotalCount(result.totalCount);
      } catch {
        if (cancelled) return;
        setError("No se pudieron cargar las notificaciones.");
        setItems([]);
        setTotalCount(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [pageNumber]);

  const handleCardClick = async (notification: NotificationResponse) => {
    setItems((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
    );
    try {
      await markNotificationRead(notification.id);
    } catch {
      // Best-effort: navigation still proceeds even if marking as read fails.
    }
    if (notification.deepLinkPath) {
      navigate(notification.deepLinkPath);
    }
  };

  const handlePageChange = (_: React.ChangeEvent<unknown>, page: number) => {
    setPageNumber(page);
  };

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Notificaciones"
        subtitle="Avisos"
        actionBar={
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate("/coach/team-dashboard")}
              variant="outlined"
              size="small"
            >
              Volver
            </Button>
          </Stack>
        }
      >
        <Box className={styles.container}>
          <Card className={styles.toggleCard}>
            <CardContent>
              <NotificationSettings />
            </CardContent>
          </Card>

          {loading && (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
              <CircularProgress />
            </Box>
          )}

          {!loading && error && <Typography color="error">{error}</Typography>}

          {!loading && !error && items.length === 0 && (
            <Typography>No tienes notificaciones.</Typography>
          )}

          {!loading && !error && items.length > 0 && (
            <>
              <Box className={styles.cardsList}>
                {items.map((notification) => (
                  <Card
                    key={notification.id}
                    className={`${styles.notificationCard} ${
                      notification.isRead ? "" : styles.unread
                    }`}
                    onClick={() => {
                      void handleCardClick(notification);
                    }}
                  >
                    <CardContent>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Typography variant="subtitle1">{notification.title}</Typography>
                        {!notification.isRead && (
                          <Chip label="Nueva" size="small" color="primary" />
                        )}
                      </Stack>
                      <Typography variant="body2">{notification.body}</Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        className={styles.timestamp}
                      >
                        {new Date(notification.createdAt).toLocaleString("es-ES")}
                      </Typography>
                    </CardContent>
                  </Card>
                ))}
              </Box>

              <Box className={styles.paginationContainer}>
                <Pagination
                  count={Math.max(1, Math.ceil(totalCount / PAGE_SIZE))}
                  page={pageNumber}
                  onChange={handlePageChange}
                />
                <Typography variant="caption" color="text.secondary">
                  Total: {totalCount} notificaciones
                </Typography>
              </Box>
            </>
          )}
        </Box>
      </ContentLayout>
    </BaseLayout>
  );
};

export default Notifications;
