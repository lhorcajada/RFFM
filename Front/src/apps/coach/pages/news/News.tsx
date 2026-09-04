import { Box, Button, CircularProgress, Tabs, Tab } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import PublishIcon from "@mui/icons-material/Publish";
import UnpublishedIcon from "@mui/icons-material/Unpublished";
import { useCallback, useEffect, useState } from "react";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import ConfirmDialog from "../../../../shared/components/ui/ConfirmDialog/ConfirmDialog";
import useTeamDashboardBack from "../../hooks/useTeamDashboardBack";
import { coachAuthService } from "../../services/authService";
import newsService, { type NewsSummaryDto, type NewsDetailDto } from "../../services/newsService";
import NewsListCard from "./components/NewsListCard";
import NewsFormDialog from "./components/NewsFormDialog";
import styles from "./News.module.css";

type Tab = "published" | "drafts";

export default function News() {
  const goToTeamDashboard = useTeamDashboardBack();
  const [tab, setTab] = useState<Tab>("published");
  const [publishedItems, setPublishedItems] = useState<NewsSummaryDto[]>([]);
  const [draftItems, setDraftItems] = useState<NewsSummaryDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<NewsDetailDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NewsSummaryDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isCoach =
    coachAuthService.hasRole("Coach") || coachAuthService.hasRole("Administrator");

  const loadPublished = useCallback(() => {
    setLoading(true);
    return newsService
      .getNews(1, 20, true)
      .then(setPublishedItems)
      .finally(() => setLoading(false));
  }, []);

  const loadDrafts = useCallback(() => {
    setLoading(true);
    return newsService
      .getNewsDrafts(1, 20)
      .then(setDraftItems)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadPublished();
  }, [loadPublished]);

  useEffect(() => {
    if (isCoach && tab === "drafts") {
      loadDrafts();
    }
  }, [isCoach, tab, loadDrafts]);

  // Publishing/unpublishing/deleting can move an item between the Publicadas and
  // Borradores tabs, so both lists are refetched — not just the active tab — otherwise
  // switching tabs shows stale data until a full page reload.
  const refetchActiveTab = () => {
    loadPublished();
    if (isCoach) loadDrafts();
  };

  const openCreateForm = () => {
    setEditingItem(null);
    setFormOpen(true);
  };

  const openEditForm = async (item: NewsSummaryDto) => {
    const detail = await newsService.getNewsById(item.id);
    setEditingItem(detail);
    setFormOpen(true);
  };

  const handleFormSaved = () => {
    setFormOpen(false);
    setEditingItem(null);
    refetchActiveTab();
  };

  const handlePublish = async (id: string) => {
    await newsService.publishNews(id);
    refetchActiveTab();
  };

  const handleUnpublish = async (id: string) => {
    await newsService.unpublishNews(id);
    refetchActiveTab();
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await newsService.deleteNews(deleteTarget.id);
      setDeleteTarget(null);
      refetchActiveTab();
    } finally {
      setDeleting(false);
    }
  };

  const items = tab === "drafts" ? draftItems : publishedItems;

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Noticias"
        subtitle="Últimas noticias del equipo"
        actionBar={
          <Box sx={{ display: "flex", gap: 1, marginLeft: "auto" }}>
            {isCoach && (
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                onClick={openCreateForm}
              >
                Nueva noticia
              </Button>
            )}
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => goToTeamDashboard()}
              variant="outlined"
              size="small"
            >
              Volver
            </Button>
          </Box>
        }
      >
        {isCoach && (
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 3 }}>
            <Tab value="published" label="Publicadas" />
            <Tab value="drafts" label="Borradores" />
          </Tabs>
        )}
        <Box sx={{ p: 3 }}>
          {loading ? (
            <CircularProgress />
          ) : items.length === 0 ? (
            <p>No hay noticias disponibles</p>
          ) : (
            <div className={styles.list}>
              {items.map((item) => (
                <div key={item.id} className={styles.cardWrapper}>
                  <NewsListCard item={item} />
                  {isCoach && (
                    <Box className={styles.actions}>
                      <Button
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={() => openEditForm(item)}
                      >
                        Editar
                      </Button>
                      {item.status === "Published" ? (
                        <Button
                          size="small"
                          startIcon={<UnpublishedIcon />}
                          onClick={() => handleUnpublish(item.id)}
                        >
                          Despublicar
                        </Button>
                      ) : (
                        <Button
                          size="small"
                          startIcon={<PublishIcon />}
                          onClick={() => handlePublish(item.id)}
                        >
                          Publicar
                        </Button>
                      )}
                      <Button
                        size="small"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={() => setDeleteTarget(item)}
                      >
                        Eliminar
                      </Button>
                    </Box>
                  )}
                </div>
              ))}
            </div>
          )}
        </Box>
      </ContentLayout>

      {isCoach && (
        <NewsFormDialog
          open={formOpen}
          initialValue={editingItem}
          onClose={() => {
            setFormOpen(false);
            setEditingItem(null);
          }}
          onSaved={handleFormSaved}
        />
      )}

      {isCoach && (
        <ConfirmDialog
          open={!!deleteTarget}
          title="Eliminar noticia"
          description={
            deleteTarget
              ? `¿Desea eliminar la noticia "${deleteTarget.title}"? Esta acción no se puede deshacer.`
              : ""
          }
          confirmText="Eliminar"
          processing={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirmed}
        />
      )}
    </BaseLayout>
  );
}
