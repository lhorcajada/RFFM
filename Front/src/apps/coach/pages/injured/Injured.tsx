import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Stack } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import useTeamAndClub from "../../hooks/useTeamAndClub.tsx";
import useTeamDashboardBack from "../../hooks/useTeamDashboardBack";
import { coachAuthService } from "../../services/authService";
import { useAuditPageAccess } from "../../../../shared/hooks/useAuditPageAccess";
import InjuredPlayersList from "./components/InjuredPlayersList";
import InjuryProtocolPanel from "./components/InjuryProtocolPanel";
import InjuryProtocolDocuments from "./components/InjuryProtocolDocuments";
import styles from "./Injured.module.css";

const TAB_LABELS = ["Lesionados", "Protocolo", "Documentos"] as const;

export default function Injured() {
  useAuditPageAccess('Injured');
  const goToTeamDashboard = useTeamDashboardBack();
  const { team, teamTitleNode } = useTeamAndClub();

  const _roles = coachAuthService.getRoles();
  const isCoach = _roles.includes("Coach") || _roles.includes("Administrator");

  const [activeTab, setActiveTab] = useState(0);
  const [searchParams] = useSearchParams();
  const highlightedId = searchParams.get("highlight");

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Lesionados"
        subtitle={teamTitleNode ?? "Histórico de lesiones de la plantilla"}
        actionBar={
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => goToTeamDashboard()}
              variant="outlined"
              size="small"
            >
              Volver
            </Button>
          </Stack>
        }
      >
        <div className={styles.tabsWrap}>
          <div role="tablist" aria-label="Secciones de lesionados" className={styles.tabs}>
            {TAB_LABELS.map((label, index) => (
              <button
                key={label}
                type="button"
                role="tab"
                aria-selected={activeTab === index}
                className={`${styles.tab} ${activeTab === index ? styles.tabActive : ""}`}
                onClick={() => setActiveTab(index)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.tabPanel}>
          {activeTab === 0 && (
            <InjuredPlayersList team={team} isCoach={isCoach} highlightedId={highlightedId} />
          )}
          {activeTab === 1 && team && (
            <InjuryProtocolPanel teamId={team.id} isCoach={isCoach} />
          )}
          {activeTab === 2 && team && (
            <InjuryProtocolDocuments teamId={team.id} isCoach={isCoach} />
          )}
        </div>
      </ContentLayout>
    </BaseLayout>
  );
}
