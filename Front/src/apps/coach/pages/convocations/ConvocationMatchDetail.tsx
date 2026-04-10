import { useEffect, useRef, useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  CircularProgress,
  Slide,
  Snackbar,
  Tab,
  Tabs,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import configurationCoachService from "../../services/configurationCoachService";
import type { IdealLineupHandle } from "../squad/components/IdealLineup";
import ConvocationTab from "./components/ConvocationTab";
import DesconvocatoriasTab from "./components/DesconvocatoriasTab";
import AlineacionTab from "./components/AlineacionTab";
import type { MatchState } from "./components/convocationMatchDetail.types";
import { useConvocationManagement } from "./hooks/useConvocationManagement";
import { useDesconvocatoriasGrid } from "./hooks/useDesconvocatoriasGrid";
import styles from "./ConvocationMatchDetail.module.css";

export default function ConvocationMatchDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const match = (location.state as { match?: MatchState } | null)?.match ?? null;

  // Team ID  from URL or fallback to coach configuration
  const params = new URLSearchParams(location.search);
  const [teamId, setTeamId] = useState(params.get("teamId") ?? "");
  useEffect(() => {
    if (teamId) return;
    let mounted = true;
    configurationCoachService
      .getAll()
      .then((configs) => {
        if (!mounted) return;
        const preferred = configs[0]?.preferredTeamId ?? "";
        if (preferred) setTeamId(preferred);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [teamId]);

  const [tab, setTab] = useState(0);
  const lineupRef = useRef<IdealLineupHandle>(null);
  const [lineupSaving, setLineupSaving] = useState(false);

  // Data hooks
  const convocation = useConvocationManagement(teamId, match?.date);
  const grid = useDesconvocatoriasGrid(teamId);

  // Players for the Alineacion tab (convocados only)
  const lineupPlayers = useMemo(
    () =>
      convocation.players
        .filter((p) => new Set(convocation.mgmtCalled).has(p.id))
        .map((p) => ({
          id: p.id,
          displayName:
            ((p.name ?? "") + " " + (p.lastName ?? "")).trim() ||
            p.alias ||
            "Jugador",
          alias: p.alias ?? null,
          photoSrc: convocation.mgmtPhotos[p.id] ?? null,
          dorsal: p.dorsal ?? null,
          position: p.position ?? null,
          competitiveness: convocation.mgmtRatings[p.id]?.competitiveness ?? null,
          isInjured: p.isInjured === true,
        })),
    [
      convocation.mgmtCalled,
      convocation.players,
      convocation.mgmtPhotos,
      convocation.mgmtRatings,
    ]
  );

  const subtitle = match
    ? `${match.localTeamName} vs ${match.visitorTeamName} · ${match.date}`
    : "Partido";

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Convocatoria"
        subtitle={subtitle}
        actionBar={
          <>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate(-1)}
              variant="outlined"
              size="small"
            >
              Volver
            </Button>
            {tab === 0 && convocation.mgmtEventId && (
              <Button
                variant="contained"
                size="small"
                startIcon={
                  convocation.mgmtSaving ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : (
                    <SaveIcon />
                  )
                }
                disabled={convocation.mgmtSaving}
                onClick={convocation.handleSave}
              >
                Guardar
              </Button>
            )}
            {tab === 2 && convocation.mgmtEventId && convocation.mgmtCalled.length > 0 && (
              <Button
                variant="contained"
                size="small"
                startIcon={
                  lineupSaving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />
                }
                disabled={lineupSaving}
                onClick={() => lineupRef.current?.save()}
              >
                Guardar
              </Button>
            )}
          </>
        }
      >
        {/* Match summary banner */}
        {match && (
          <div className={styles.matchBanner}>
            <div className={styles.bannerTeam}>
              {match.localTeamShield && (
                <img
                  src={match.localTeamShield}
                  alt=""
                  className={styles.bannerShield}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
              <span className={styles.bannerTeamName}>{match.localTeamName}</span>
            </div>
            <div className={styles.bannerCenter}>
              <span className={styles.bannerTime}>{match.time || "--:--"}</span>
              <span className={styles.bannerKickoff}>kick-off</span>
            </div>
            <div className={`${styles.bannerTeam} ${styles.bannerTeamRight}`}>
              {match.visitorTeamShield && (
                <img
                  src={match.visitorTeamShield}
                  alt=""
                  className={styles.bannerShield}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
              <span className={styles.bannerTeamName}>{match.visitorTeamName}</span>
            </div>
          </div>
        )}

        {/* Tabs */}
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          textColor="inherit"
          indicatorColor="secondary"
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: "1px solid rgba(255,255,255,0.08)", px: 1 }}
        >
          <Tab label="Convocatoria" />
          <Tab label="Desconvocatorias" />
          <Tab label="Alineación" />
        </Tabs>

        {/* Tab 0: Convocatoria */}
        {tab === 0 && (
          <ConvocationTab
            mgmtEventId={convocation.mgmtEventId}
            mgmtLoadingConv={convocation.mgmtLoadingConv}
            loadingPlayers={convocation.loadingPlayers}
            teamAvgRating={convocation.teamAvgRating}
            mgmtCalled={convocation.mgmtCalled}
            mgmtAvailable={convocation.mgmtAvailable}
            mgmtNotCalled={convocation.mgmtNotCalled}
            mgmtNoDisponible={convocation.mgmtNoDisponible}
            players={convocation.players}
            mgmtRatings={convocation.mgmtRatings}
            mgmtPhotos={convocation.mgmtPhotos}
            mgmtExcuseMap={convocation.mgmtExcuseMap}
            excuseTypes={convocation.excuseTypes}
            mgmtDragPlayer={convocation.mgmtDragPlayer}
            mgmtDragOver={convocation.mgmtDragOver}
            onDragStart={convocation.handleDragStart}
            onDragEnd={() => {
              convocation.setMgmtDragOver(null);
            }}
            onDragOver={convocation.setMgmtDragOver}
            onDragLeave={() => convocation.setMgmtDragOver(null)}
            onDrop={convocation.handleDrop}
            onExcuseChange={(pid, excuseId) =>
              convocation.setMgmtExcuseMap((prev) => ({ ...prev, [pid]: excuseId }))
            }
          />
        )}

        {/* Save snackbar */}
        <Snackbar
          open={convocation.mgmtSaveResult !== null}
          autoHideDuration={4500}
          onClose={() => convocation.setMgmtSaveResult(null)}
          anchorOrigin={{ vertical: "top", horizontal: "right" }}
          TransitionComponent={(props) => <Slide {...props} direction="down" />}
        >
          <Alert
            severity={convocation.mgmtSaveResult === "success" ? "success" : "error"}
            onClose={() => convocation.setMgmtSaveResult(null)}
            sx={{ width: "100%" }}
          >
            {convocation.mgmtSaveResult === "success"
              ? "Convocatoria guardada correctamente"
              : convocation.mgmtSaveResult ??
                "Error al guardar la convocatoria. Inténtalo de nuevo."}
          </Alert>
        </Snackbar>

        {/* Tab 1: Desconvocatorias */}
        {tab === 1 && (
          <DesconvocatoriasTab
            players={convocation.players}
            matchColumns={grid.matchColumns}
            enrichedGrid={grid.enrichedGrid}
            isLoading={grid.isLoading}
            teamId={teamId}
          />
        )}

        {/* Tab 2: Alineacion */}
        {tab === 2 && (
          <AlineacionTab
            mgmtEventId={convocation.mgmtEventId}
            mgmtCalled={convocation.mgmtCalled}
            lineupPlayers={lineupPlayers}
            lineupRef={lineupRef}
            teamId={teamId}
            onSavingChange={setLineupSaving}
          />
        )}
      </ContentLayout>
    </BaseLayout>
  );
}
