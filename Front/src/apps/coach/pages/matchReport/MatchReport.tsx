import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Alert, Avatar, Button, CircularProgress, Tab, Tabs } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import { useAuditPageAccess } from "../../../../shared/hooks/useAuditPageAccess";
import { resolveStorageUrl } from "../../../../shared/utils/resolveStorageUrl";
import { getMatchReport, type MatchReport as MatchReportType } from "../../services/matchReportService";
import FederationActaTab from "./components/FederationActaTab";
import LiveReportTab from "./components/LiveReportTab";
import styles from "./MatchReport.module.css";

type ReportTab = "federation" | "live";

const TAB_LABELS: Record<ReportTab, string> = {
  federation: "Federación",
  live: "Partido en directo",
};

function formatDate(raw: string | null): string {
  if (!raw) return "";
  const date = new Date(raw);
  return isNaN(date.getTime()) ? "" : date.toLocaleDateString("es-ES", { dateStyle: "medium" });
}

function MatchHeader({ report }: { report: MatchReportType }) {
  const team = { name: report.teamName ?? "Mi equipo", photo: resolveStorageUrl(report.teamPhotoUrl) };
  const rival = { name: report.rivalName ?? "Rival", photo: resolveStorageUrl(report.rivalPhotoUrl) };
  const [local, visitor] = report.isHomeMatch ? [team, rival] : [rival, team];
  const hasScore = report.localGoals != null && report.localGoals !== "" && report.visitorGoals != null && report.visitorGoals !== "";

  return (
    <div className={styles.header}>
      <div className={styles.team}>
        <Avatar src={local.photo || undefined} alt={local.photo ? `Escudo de ${local.name}` : ""} className={styles.shield} />
        <span className={styles.teamName}>{local.name}</span>
      </div>
      <div className={styles.scoreBlock}>
        <span className={styles.score}>{hasScore ? `${report.localGoals} - ${report.visitorGoals}` : "-"}</span>
        <span className={styles.date}>{formatDate(report.date)}</span>
      </div>
      <div className={styles.team}>
        <Avatar src={visitor.photo || undefined} alt={visitor.photo ? `Escudo de ${visitor.name}` : ""} className={styles.shield} />
        <span className={styles.teamName}>{visitor.name}</span>
      </div>
    </div>
  );
}

export default function MatchReport() {
  useAuditPageAccess("MatchReport");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get("eventId") ?? "";

  const [report, setReport] = useState<MatchReportType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedTab, setSelectedTab] = useState<ReportTab | null>(null);

  useEffect(() => {
    if (!eventId) {
      setLoading(false);
      setError(true);
      return;
    }
    let mounted = true;
    setLoading(true);
    setError(false);
    getMatchReport(eventId)
      .then((data) => {
        if (mounted) setReport(data);
      })
      .catch(() => {
        if (mounted) setError(true);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [eventId]);

  const availableTabs: ReportTab[] = [];
  if (report?.hasFederationReport) availableTabs.push("federation");
  if (report?.hasLiveReport && report.live) availableTabs.push("live");
  const activeTab = selectedTab && availableTabs.includes(selectedTab) ? selectedTab : availableTabs[0];

  function renderTab(tab: ReportTab | undefined) {
    if (!report || !tab) return <EmptyState description="No hay acta disponible para este partido." />;
    if (tab === "federation") return <FederationActaTab eventId={report.eventId} />;
    return report.live ? <LiveReportTab report={report.live} /> : null;
  }

  function renderContent() {
    if (loading) {
      return (
        <div className={styles.center}>
          <CircularProgress />
        </div>
      );
    }
    if (error || !report) {
      return <Alert severity="error">No se ha podido cargar el acta del partido.</Alert>;
    }
    return (
      <>
        <MatchHeader report={report} />
        {availableTabs.length > 1 && (
          <div className={styles.tabsWrap}>
            <Tabs value={activeTab} onChange={(_, value: ReportTab) => setSelectedTab(value)} variant="fullWidth">
              {availableTabs.map((tab) => (
                <Tab key={tab} value={tab} label={TAB_LABELS[tab]} />
              ))}
            </Tabs>
          </div>
        )}
        <div className={styles.tabPanel}>{renderTab(activeTab)}</div>
      </>
    );
  }

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Acta del partido"
        actionBar={
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} variant="outlined" size="small">
            Volver
          </Button>
        }
      >
        {renderContent()}
      </ContentLayout>
    </BaseLayout>
  );
}
