import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  Chip,
  FormControlLabel,
  Pagination,
  Stack,
  Typography,
} from "@mui/material";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ConfirmDialog from "../../../../shared/components/ui/ConfirmDialog/ConfirmDialog";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import { useAuditPageAccess } from "../../../../shared/hooks/useAuditPageAccess";
import NotificationSettings from "../settings/components/NotificationSettings/NotificationSettings";
import {
  searchNotifications,
  markNotificationRead,
  deleteNotifications,
  deleteAllNotifications,
  NOTIFICATIONS_CHANGED_EVENT,
  type NotificationResponse,
} from "../../../../shared/services/notificationService";
import styles from "./Notifications.module.css";

const PAGE_SIZE = 25;

type DeleteTarget = "selected" | "all";

const Notifications: React.FC = () => {
  useAuditPageAccess("Notifications");
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<NotificationResponse[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const silentRefresh = useRef(false);

  useEffect(() => {
    const handleChanged = () => {
      silentRefresh.current = true;
      setRefreshKey((key) => key + 1);
    };
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, handleChanged);
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, handleChanged);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!silentRefresh.current) setLoading(true);
      silentRefresh.current = false;
      setError(null);
      try {
        const result = await searchNotifications(pageNumber, PAGE_SIZE, { app: "coach" });
        if (cancelled) return;
        setItems(result.items);
        setTotalCount(result.totalCount);
        setSelectedIds((prev) => new Set(result.items.filter((n) => prev.has(n.id)).map((n) => n.id)));
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
  }, [pageNumber, refreshKey]);

  const handleCardClick = async (notification: NotificationResponse) => {
    setItems((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
    );
    try {
      await markNotificationRead(notification.id);
      window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT));
    } catch {
      // Best-effort: navigation still proceeds even if marking as read fails.
    }
    if (notification.deepLinkPath) {
      navigate(notification.deepLinkPath);
    }
  };

  const handlePageChange = (_: React.ChangeEvent<unknown>, page: number) => {
    setSelectedIds(new Set());
    setPageNumber(page);
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = items.length > 0 && items.every((n) => selectedIds.has(n.id));
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(items.map((n) => n.id)));
  };

  const handleDeleteConfirmed = async () => {
    const ids = Array.from(selectedIds);
    const deletingAll = deleteTarget === "all";
    setDeleting(true);
    try {
      const deleted = deletingAll ? await deleteAllNotifications("coach") : await deleteNotifications(ids);
      setDeleteTarget(null);
      setSelectedIds(new Set());
      if (deletingAll) {
        setPageNumber(1);
      } else {
        const pageEmptied = ids.length >= items.length && pageNumber > 1;
        if (pageEmptied) setPageNumber((page) => page - 1);
      }
      window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT));
      window.dispatchEvent(
        new CustomEvent("rffm.show_snackbar", {
          detail: {
            message: deleted === 1 ? "Notificación eliminada" : `${deleted} notificaciones eliminadas`,
            severity: "success",
          },
        })
      );
    } catch {
      setDeleteTarget(null);
      window.dispatchEvent(
        new CustomEvent("rffm.show_snackbar", {
          detail: { message: "No se pudieron eliminar las notificaciones.", severity: "error" },
        })
      );
    } finally {
      setDeleting(false);
    }
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
              <Box className={styles.selectionBar}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={allSelected}
                      indeterminate={someSelected}
                      onChange={toggleSelectAll}
                    />
                  }
                  label="Seleccionar todas"
                />
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Button
                    color="error"
                    variant="outlined"
                    size="small"
                    startIcon={<DeleteOutlineIcon />}
                    disabled={selectedIds.size === 0}
                    onClick={() => setDeleteTarget("selected")}
                  >
                    {selectedIds.size > 0 ? `Eliminar (${selectedIds.size})` : "Eliminar"}
                  </Button>
                  <Button
                    color="error"
                    variant="contained"
                    size="small"
                    startIcon={<DeleteSweepIcon />}
                    onClick={() => setDeleteTarget("all")}
                  >
                    Eliminar todas
                  </Button>
                </Stack>
              </Box>

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
                        <Stack direction="row" alignItems="flex-start" spacing={0.5}>
                          <Checkbox
                            size="small"
                            className={styles.cardCheckbox}
                            checked={selectedIds.has(notification.id)}
                            onClick={(event) => event.stopPropagation()}
                            onChange={() => toggleSelected(notification.id)}
                            inputProps={{ "aria-label": `Seleccionar ${notification.title}` }}
                          />
                          <Typography variant="subtitle1">{notification.title}</Typography>
                        </Stack>
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

        <ConfirmDialog
          open={deleteTarget !== null}
          title={deleteTarget === "all" ? "Eliminar todas las notificaciones" : "Eliminar notificaciones"}
          description={
            deleteTarget === "all"
              ? `¿Eliminar las ${totalCount} notificaciones de todas las páginas? Esta acción no se puede deshacer.`
              : selectedIds.size === 1
                ? "¿Eliminar la notificación seleccionada? Esta acción no se puede deshacer."
                : `¿Eliminar las ${selectedIds.size} notificaciones seleccionadas? Esta acción no se puede deshacer.`
          }
          confirmText="Eliminar"
          processing={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            void handleDeleteConfirmed();
          }}
        />
      </ContentLayout>
    </BaseLayout>
  );
};

export default Notifications;
