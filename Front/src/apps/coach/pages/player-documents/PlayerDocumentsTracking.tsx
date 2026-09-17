import { useEffect, useState } from "react";
import { CircularProgress, MenuItem, Select, Stack, Typography } from "@mui/material";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import PlayerDocumentStatusChip from "../../../../shared/components/ui/PlayerDocumentStatusChip/PlayerDocumentStatusChip";
import useTeamAndClub from "../../hooks/useTeamAndClub";
import {
  getDocumentTypes,
  getTeamDocumentsStatus,
  mapPlayerDocumentError,
  type DocumentTypeResponse,
  type PlayerDocumentStatus,
  type TeamPlayerDocumentStatusResponse,
} from "../../services/playerDocumentService";
import TeamPlayerDocumentCard from "./components/TeamPlayerDocumentCard";
import DocumentReportButton from "./components/DocumentReportButton";
import styles from "./PlayerDocumentsTracking.module.css";

const STATUS_GROUP_ORDER: PlayerDocumentStatus[] = ["Pending", "Delivered", "Approved", "Rejected"];

const STATUS_GROUP_LABELS: Record<PlayerDocumentStatus, string> = {
  Pending: "Pendientes",
  Delivered: "Entregados",
  Approved: "Aprobados",
  Rejected: "Rechazados",
};

export default function PlayerDocumentsTracking() {
  const { team } = useTeamAndClub();
  const [loading, setLoading] = useState(true);
  const [documentTypes, setDocumentTypes] = useState<DocumentTypeResponse[]>([]);
  const [documentTypeId, setDocumentTypeId] = useState<string>("");
  const [documents, setDocuments] = useState<TeamPlayerDocumentStatusResponse[]>([]);

  async function load() {
    if (!team?.id) return;
    setLoading(true);
    try {
      const types = await getDocumentTypes();
      setDocumentTypes(types);
      if (types.length > 0 && !documentTypeId) {
        setDocumentTypeId(types[0].id);
      }
    } catch (err: any) {
      const code = err?.response?.data?.code;
      const error = mapPlayerDocumentError(code);
      window.dispatchEvent(
        new CustomEvent("rffm.show_snackbar", {
          detail: { message: error.message, severity: error.severity },
        })
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadDocuments() {
    if (!team?.id || !documentTypeId) return;
    try {
      const docs = await getTeamDocumentsStatus(team.id, documentTypeId);
      setDocuments(docs);
    } catch (err: any) {
      const code = err?.response?.data?.code;
      const error = mapPlayerDocumentError(code);
      window.dispatchEvent(
        new CustomEvent("rffm.show_snackbar", {
          detail: { message: error.message, severity: error.severity },
        })
      );
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team?.id]);

  useEffect(() => {
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentTypeId]);

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Documentos"
        subtitle="Seguimiento de documentos de los jugadores"
        actionBar={
          <Stack direction="row" spacing={1} alignItems="center">
            {documentTypeId && team?.id && (
              <DocumentReportButton
                teamId={team.id}
                documentTypeId={documentTypeId}
              />
            )}
          </Stack>
        }
      >
        <div className={styles.filterSection}>
          <Select
            value={documentTypeId}
            onChange={(e) => setDocumentTypeId(e.target.value)}
            size="small"
            disabled={loading || documentTypes.length === 0}
          >
            {documentTypes.map((type) => (
              <MenuItem key={type.id} value={type.id}>
                {type.name}
              </MenuItem>
            ))}
          </Select>
        </div>

        {loading ? (
          <Stack alignItems="center" sx={{ py: 6 }}>
            <CircularProgress size={32} />
          </Stack>
        ) : documents.length === 0 ? (
          <EmptyState
            title="No hay documentos"
            description="No hay documentos de jugadores para este tipo."
          />
        ) : (
          STATUS_GROUP_ORDER.map((status) => {
            const group = documents.filter((doc) => doc.status === status);
            return (
              <div key={status} className={styles.statusGroup}>
                <div className={styles.statusGroupTitle}>
                  <PlayerDocumentStatusChip status={status} />
                  <Typography variant="subtitle2">
                    {STATUS_GROUP_LABELS[status]} ({group.length})
                  </Typography>
                </div>

                {group.length === 0 ? (
                  <Typography className={styles.statusGroupEmpty}>
                    Sin jugadores en este estado.
                  </Typography>
                ) : (
                  <div className={styles.cardsGrid}>
                    {group.map((doc) => (
                      <TeamPlayerDocumentCard
                        key={doc.teamPlayerId}
                        row={doc}
                        documentTypeId={documentTypeId}
                        teamId={team?.id || ""}
                        onChanged={loadDocuments}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </ContentLayout>
    </BaseLayout>
  );
}
