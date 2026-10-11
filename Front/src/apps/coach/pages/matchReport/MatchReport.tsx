import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Alert, Avatar, Button, CircularProgress, Tab, Tabs } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import { useAuditPageAccess } from "../../../../shared/hooks/useAuditPageAccess";
import { resolveStorageUrl } from "../../../../shared/utils/resolveStorageUrl";
import ActaContent from "../../../../shared/components/acta/ActaContent/ActaContent";
import type { Acta } from "../../../../shared/types/acta";
import {
  getFederationActaByCode,
  getMatchReport,
  type MatchReport as MatchReportType,
} from "../../services/matchReportService";
import PlayerQuickViewDialog from "../../../federation/components/players/PlayerQuickViewDialog/PlayerQuickViewDialog";
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

type HeaderSide = { name: string; photo: string | null | undefined };

type MatchHeaderProps = {
  local: HeaderSide;
  visitor: HeaderSide;
  localGoals: string | null | undefined;
  visitorGoals: string | null | undefined;
  date: string;
};

function reportHeader(report: MatchReportType): MatchHeaderProps {
  const team = { name: report.teamName ?? "Mi equipo", photo: resolveStorageUrl(report.teamPhotoUrl) };
  const rival = { name: report.rivalName ?? "Rival", photo: resolveStorageUrl(report.rivalPhotoUrl) };
  const [local, visitor] = report.isHomeMatch ? [team, rival] : [rival, team];
  return { local, visitor, localGoals: report.localGoals, visitorGoals: report.visitorGoals, date: formatDate(report.date) };
}

function actaHeader(acta: Acta): MatchHeaderProps {
  return {
    local: { name: acta.equipo_local ?? "Local", photo: acta.escudo_local },
    visitor: { name: acta.equipo_visitante ?? "Visitante", photo: acta.escudo_visitante },
    localGoals: acta.goles_local,
    visitorGoals: acta.goles_visitante,
    date: acta.fecha ?? "",
  };
}

function MatchHeader({ local, visitor, localGoals, visitorGoals, date }: MatchHeaderProps) {
  const hasScore = localGoals != null && localGoals !== "" && visitorGoals != null && visitorGoals !== "";

  return (
    <div className={styles.header}>
      <div className={styles.team}>
        <Avatar src={local.photo || undefined} alt={local.photo ? `Escudo de ${local.name}` : ""} className={styles.shield} />
        <span className={styles.teamName}>{local.name}</span>
      </div>
      <div className={styles.scoreBlock}>
        <span className={styles.score}>{hasScore ? `${localGoals} - ${visitorGoals}` : "-"}</span>
        <span className={styles.date}>{date}</span>
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
  const codActa = searchParams.get("codActa") ?? "";
  const season = searchParams.get("season") ?? "";
  const competition = searchParams.get("competition") ?? "";
  const group = searchParams.get("group") ?? "";
  const isFederationOnly = !eventId && codActa !== "";

  const [report, setReport] = useState<MatchReportType | null>(null);
  const [acta, setActa] = useState<Acta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedTab, setSelectedTab] = useState<ReportTab | null>(null);
  const [playerTarget, setPlayerTarget] = useState<{ code: string; name: string | null } | null>(null);

  const handlePlayerClick = (playerCode: string, playerName?: string) => {
    const code = playerCode.trim();
    if (code) setPlayerTarget({ code, name: playerName ?? null });
  };

  useEffect(() => {
    if (!eventId && !codActa) {
      setLoading(false);
      setError(true);
      return;
    }
    let mounted = true;
    setLoading(true);
    setError(false);
    const load = eventId
      ? getMatchReport(eventId).then((data) => {
          if (mounted) setReport(data);
        })
      : getFederationActaByCode(codActa, { season, competition, group }).then((data) => {
          if (mounted) setActa(data);
        });
    load
      .catch(() => {
        if (mounted) setError(true);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [eventId, codActa, season, competition, group]);

  const availableTabs: ReportTab[] = [];
  if (report?.hasFederationReport) availableTabs.push("federation");
  if (report?.hasLiveReport && report.live) availableTabs.push("live");
  const activeTab = selectedTab && availableTabs.includes(selectedTab) ? selectedTab : availableTabs[0];

  function renderTab(tab: ReportTab | undefined) {
    if (!report || !tab) return <EmptyState description="No hay acta disponible para este partido." />;
    if (tab === "federation") return <FederationActaTab eventId={report.eventId} onPlayerClick={handlePlayerClick} />;
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
    if (isFederationOnly) {
      if (error || !acta) return <EmptyState description="No hay acta disponible para este partido." />;
      return (
        <>
          <MatchHeader {...actaHeader(acta)} />
          <div className={styles.tabPanel}>
            <ActaContent acta={acta} onPlayerClick={handlePlayerClick} />
          </div>
        </>
      );
    }
    if (error || !report) {
      return <Alert severity="error">No se ha podido cargar el acta del partido.</Alert>;
    }
    return (
      <>
        <MatchHeader {...reportHeader(report)} />
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
        <PlayerQuickViewDialog
          open={playerTarget !== null}
          playerCode={playerTarget?.code ?? null}
          playerName={playerTarget?.name}
          seasonId={season || undefined}
          onClose={() => setPlayerTarget(null)}
        />
      </ContentLayout>
    </BaseLayout>
  );
}
