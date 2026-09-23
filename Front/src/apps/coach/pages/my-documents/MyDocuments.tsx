import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, CircularProgress, Stack } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import { getMyProfile } from "../../services/coachApi";
import {
  getDocumentTypes,
  getPlayerDocuments,
  mapPlayerDocumentError,
  type DocumentTypeResponse,
  type PlayerDocumentResponse,
} from "../../services/playerDocumentService";
import { useAuditPageAccess } from "../../../../shared/hooks/useAuditPageAccess";
import MyDocumentCard from "./components/MyDocumentCard";
import styles from "./MyDocuments.module.css";

export default function MyDocuments() {
  useAuditPageAccess('MyDocuments');
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [teamPlayerId, setTeamPlayerId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<PlayerDocumentResponse[]>([]);

  async function load() {
    setLoading(true);
    try {
      const profile = await getMyProfile();
      if (!profile?.teamPlayerId) {
        navigate("/appSelector", { replace: true, state: { needsTeamRelink: true } });
        return;
      }
      setTeamPlayerId(profile.teamPlayerId);
      const [docTypes, myDocs] = await Promise.all([
        getDocumentTypes(),
        getPlayerDocuments(profile.teamPlayerId),
      ]);
      setDocuments(myDocs);
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

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Mis documentos"
        subtitle="Autorizaciones y documentos de tu jugador"
        actionBar={
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate("/coach/team-dashboard")}
            variant="outlined"
            size="small"
            sx={{ marginLeft: "auto" }}
          >
            Volver
          </Button>
        }
      >
        {loading ? (
          <Stack alignItems="center" sx={{ py: 6 }}>
            <CircularProgress size={32} />
          </Stack>
        ) : documents.length === 0 ? (
          <EmptyState title="No hay documentos" description="No hay tipos de documento configurados." />
        ) : (
          <div className={styles.cardsGrid}>
            {documents.map((doc) => (
              <MyDocumentCard
                key={doc.documentTypeId}
                document={doc}
                teamPlayerId={teamPlayerId as string}
                onUploaded={load}
              />
            ))}
          </div>
        )}
      </ContentLayout>
    </BaseLayout>
  );
}
