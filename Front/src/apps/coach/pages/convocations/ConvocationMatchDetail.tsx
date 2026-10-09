import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Alert,
  CircularProgress,
  Slide,
  Snackbar,
  Tab,
  Tabs,
} from "@mui/material";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import configurationCoachService from "../../services/configurationCoachService";
import { getSportEventById } from "../../services/sportEventService";
import ConvocationTab from "./components/ConvocationTab";
import DesconvocatoriasTab from "./components/DesconvocatoriasTab";
import ConvocatoriaPrint, { type ConvocatoriaPrintHandle } from "./components/ConvocatoriaPrint";
import ConvocationDetailsDialog from "./components/ConvocationDetailsDialog";
import { CONVOCATION_TAB, type MatchState } from "./components/convocationMatchDetail.types";
import { coachAuthService } from "../../services/authService";
import { useConvocationManagement } from "./hooks/useConvocationManagement";
import { useDesconvocatoriasGrid } from "./hooks/useDesconvocatoriasGrid";
import { useConvocationMatchContext } from "./hooks/useConvocationMatchContext";
import { useConvocationPlayerViews } from "./hooks/useConvocationPlayerViews";
import { useConvocationProposal } from "./hooks/useConvocationProposal";
import { useTeamReadinessMap } from "./hooks/useTeamReadinessMap";
import type { ClubKit } from "../../services/kitService";
import { getTeamKits, updateEventKit } from "../../services/kitService";
import { toMatchState } from "./helpers/convocationUtils";
import styles from "./ConvocationMatchDetail.module.css";
import ConvocationMatchHeader from "./components/ConvocationMatchHeader";
import ConvocationMatchActionBar from "./components/ConvocationMatchActionBar";

export default function ConvocationMatchDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const stateMatch = (location.state as { match?: MatchState } | null)?.match ?? null;

  // Team ID  from URL or fallback to coach configuration
  const params = new URLSearchParams(location.search);
  const [teamId, setTeamId] = useState(params.get("teamId") ?? "");
  const seasonId = params.get("seasonId");
  const eventIdParam = params.get("eventId");

  // Fast path: router state carries the match (normal in-app navigation). Slow path: state
  // was lost (F5 reload / direct URL navigation) but the URL still carries ?eventId= — fetch
  // the match fresh from the backend so the screen survives a refresh.
  const [match, setMatch] = useState<MatchState | null>(stateMatch);
  const [matchLoading, setMatchLoading] = useState(!stateMatch && !!eventIdParam);

  useEffect(() => {
    if (stateMatch || !eventIdParam) return;
    let mounted = true;
    setMatchLoading(true);
    getSportEventById(eventIdParam)
      .then((event) => {
        if (!mounted) return;
        setMatch(event ? toMatchState(event) : null);
      })
      .catch(() => {
        if (mounted) setMatch(null);
      })
      .finally(() => {
        if (mounted) setMatchLoading(false);
      });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventIdParam]);

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

  const [tab, setTab] = useState<number>(CONVOCATION_TAB.Convocatoria);
  // Desconvocatorias y Convocatoria son las únicas pestañas que necesitan el grid
  // histórico de convocatorias; una vez visitadas, se mantiene cargado al cambiar de pestaña.
  const needsGridData = tab === CONVOCATION_TAB.Desconvocatorias || tab === CONVOCATION_TAB.Convocatoria;
  const [gridEnabled, setGridEnabled] = useState(needsGridData);
  useEffect(() => {
    if (needsGridData) setGridEnabled(true);
  }, [needsGridData]);
  // La propuesta de convocatoria (temporada, lesiones, starts, entrenos) solo la usa
  // la pestaña Convocatoria; se activa la primera vez que se visita y se mantiene.
  const needsProposalData = tab === CONVOCATION_TAB.Convocatoria;
  const [proposalEnabled, setProposalEnabled] = useState(needsProposalData);
  useEffect(() => {
    if (needsProposalData) setProposalEnabled(true);
  }, [needsProposalData]);
  // PDF print
  const printRef = useRef<ConvocatoriaPrintHandle>(null);
  const [printing, setPrinting] = useState(false);
  const handlePrint = useCallback(async () => {
    if (printing) return;
    setPrinting(true);
    try {
      await printRef.current?.print();
    } finally {
      setPrinting(false);
    }
  }, [printing]);

  const handlePrintProposal = useCallback(async () => {
    if (printing) return;
    setPrinting(true);
    try {
      await printRef.current?.printProposal();
    } finally {
      setPrinting(false);
    }
  }, [printing]);

  // "Ver convocatoria" dialog
  const [viewConvocationOpen, setViewConvocationOpen] = useState(false);

  // Kit state
  const [kits, setKits] = useState<ClubKit[]>([]);
  const [selectedKitNumber, setSelectedKitNumber] = useState<number | null>(match?.selectedKitNumber ?? null);
  const [kitUpdating, setKitUpdating] = useState(false);

  useEffect(() => {
    if (!teamId) return;
    let mounted = true;
    getTeamKits(teamId).then((data) => {
      if (mounted) setKits(data);
    }).catch(() => {});
    return () => { mounted = false; };
  }, [teamId]);

  const readinessMap = useTeamReadinessMap(teamId);

  // Data hooks
  const convocation = useConvocationManagement(teamId, match?.date);

  useEffect(() => {
    if (!convocation.mgmtEventId) return;
    let mounted = true;
    getSportEventById(convocation.mgmtEventId)
      .then((event) => {
        if (!mounted) return;
        // `match.selectedKitNumber` is only a snapshot taken when this page was navigated
        // to (router state) — refresh it from the server so a kit saved in a previous
        // visit isn't lost when the page is re-entered.
        setSelectedKitNumber(event?.selectedKitNumber ?? null);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [convocation.mgmtEventId]);
  const grid = useDesconvocatoriasGrid(teamId, gridEnabled);

  const {
    seasonEvents,
    seasonStats,
    gridStartsCountMap,
    lastInjuryEndMap,
    lastInjuryMissedEventsMap,
    weekTrainingStatsMap,
    weekTrainingCount,
    loadingProposalContext,
  } = useConvocationMatchContext(teamId, match?.date, seasonId, convocation.players, proposalEnabled);

  const excuseTypesById = useMemo(
    () => new Map(convocation.excuseTypes.map((e) => [e.id, { name: e.name, justified: e.justified }])),
    [convocation.excuseTypes],
  );

  const {
    playerStreaks,
    playerTechnicalTotals,
  } = useConvocationPlayerViews({
    players: convocation.players,
    mgmtNotCalled: convocation.mgmtNotCalled,
    mgmtPending: convocation.mgmtPending,
    mgmtPhotos: convocation.mgmtPhotos,
    mgmtRatings: convocation.mgmtRatings,
    matchColumns: grid.matchColumns,
    enrichedGrid: grid.enrichedGrid,
    readinessMap,
    assistanceMap: convocation.mgmtAssistanceMap,
    excuseMap: convocation.mgmtExcuseMap,
    excuseTypesById,
  });

  const handleKitSelect = useCallback(async (kitNumber: number | null) => {
    if (!convocation.mgmtEventId || kitUpdating) return;
    setKitUpdating(true);
    try {
      await updateEventKit(convocation.mgmtEventId, kitNumber);
      setSelectedKitNumber(kitNumber);
    } catch {
      // silently ignore — UI stays in previous state
    } finally {
      setKitUpdating(false);
    }
  }, [convocation.mgmtEventId, kitUpdating]);

  // At least one player called up — the convocation exists and can be viewed, even if some
  // of them are still pending confirmation (those are shown tagged as such in the dialog).
  const convocationConfirmed = convocation.mgmtCalled.length > 0;

  const proposalRivalName = useMemo(() => {
    if (!match) return null;
    return match.isHomeTeam ? match.visitorTeamName : match.localTeamName;
  }, [match]);

  const squadIds = useMemo(() => convocation.players.map((p) => p.id), [convocation.players]);

  const proposal = useConvocationProposal({
    players: convocation.players,
    squadIds,
    ratings: convocation.mgmtRatings,
    playerStreaks,
    playerTechnicalTotals,
    seasonEvents: seasonEvents as any,
    seasonColumns: grid.matchColumns,
    enrichedGrid: grid.enrichedGrid,
    seasonStats,
    lastInjuryEndMap,
    lastInjuryMissedEventsMap,
    currentDate: match?.date,
    currentEventId: convocation.mgmtEventId,
    currentRival: proposalRivalName,
    weekTrainingStats: weekTrainingStatsMap,
    weekTrainingCount,
    gridStartsCountMap,
  });

  const handleApplyProposal = useCallback(
    async (ids: string[]) => {
      const technicalExcuseId =
        convocation.excuseTypes.find((e) => e.name.toLowerCase().includes("decisi"))?.id ?? null;
      // Players already not called keep their existing reason (injury, justified absence…).
      const alreadyNotCalled = new Set(convocation.mgmtNotCalled);
      for (const id of ids) {
        if (alreadyNotCalled.has(id)) continue;
        await convocation.moveToNotCalled(id, technicalExcuseId);
      }
    },
    [convocation],
  );
  // Alineación, Simular Partido y Partido en directo se abren a pantalla completa.
  const openFullScreen = useCallback(
    (screen: "lineup" | "simulation" | "live") => {
      navigate(
        `/coach/convocations/${screen}?teamId=${encodeURIComponent(teamId)}&eventId=${encodeURIComponent(convocation.mgmtEventId ?? "")}`,
        { state: { match } },
      );
    },
    [navigate, teamId, convocation.mgmtEventId, match],
  );

  const handleTabChange = (value: number) => {
    if (value === CONVOCATION_TAB.Alineacion) openFullScreen("lineup");
    else if (value === CONVOCATION_TAB.Simulacion) openFullScreen("simulation");
    else setTab(value);
  };

  const matchTitle = (
    <ConvocationMatchHeader
      match={match}
      teamId={teamId}
      kits={kits}
      selectedKitNumber={selectedKitNumber}
      onSelectKit={handleKitSelect}
      onKitsSaved={setKits}
      disabled={kitUpdating || !convocation.mgmtEventId}
    />
  );

  if (matchLoading) {
    return (
      <BaseLayout hideFooterMenu>
        <ContentLayout title="Cargando partido...">
          <div className={styles.matchLoadingWrapper}>
            <CircularProgress />
          </div>
        </ContentLayout>
      </BaseLayout>
    );
  }

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title={matchTitle}
        actionBar={
          <ConvocationMatchActionBar
            teamId={teamId}
            tab={tab}
            eventId={convocation.mgmtEventId}
            printing={printing}
            convocationConfirmed={convocationConfirmed}
            onBack={() => navigate(`/coach/convocations${teamId ? `?teamId=${teamId}` : ""}`)}
            onOpenEvent={() => navigate(`/coach/attendance/${convocation.mgmtEventId}`)}
            onSaveConvocation={convocation.handleSave}
            onPrint={handlePrint}
            onViewConvocation={() => setViewConvocationOpen(true)}
            onOpenLiveMatch={() => openFullScreen("live")}
          />
        }
      >
        {/* Tabs */}
        <Tabs
          value={tab}
          onChange={(_, v) => handleTabChange(v)}
          textColor="inherit"
          indicatorColor="secondary"
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: "1px solid rgba(255,255,255,0.08)", px: 1 }}
        >
          <Tab label="Desconvocatorias" value={CONVOCATION_TAB.Desconvocatorias} />
          <Tab label="Convocatoria" value={CONVOCATION_TAB.Convocatoria} />
          <Tab label="Alineación" value={CONVOCATION_TAB.Alineacion} />
          <Tab label="Simular Partido" value={CONVOCATION_TAB.Simulacion} />
        </Tabs>

        {tab === CONVOCATION_TAB.Convocatoria && (
          <ConvocationTab
            mgmtEventId={convocation.mgmtEventId}
            mgmtLoadingConv={convocation.mgmtLoadingConv}
            loadingPlayers={convocation.loadingPlayers}
            teamAvgRating={convocation.teamAvgRating}
            isLeagueMatch={convocation.mgmtIsLeagueMatch}
            mgmtWaiting={convocation.mgmtWaiting}
            mgmtAvailabilityPending={convocation.mgmtAvailabilityPending}
            mgmtCalled={convocation.mgmtCalled}
            mgmtAvailable={convocation.mgmtAvailable}
            mgmtNotCalled={convocation.mgmtNotCalled}
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
            playerStreaks={playerStreaks}
            proposal={proposal}
            proposalLoading={loadingProposalContext || grid.isLoading || convocation.loadingPlayers}
            onApplyProposal={handleApplyProposal}
            onPrintProposal={handlePrintProposal}
            readinessMap={readinessMap}
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

        {tab === CONVOCATION_TAB.Desconvocatorias && (
          <DesconvocatoriasTab
            players={convocation.players}
            matchColumns={grid.matchColumns}
            enrichedGrid={grid.enrichedGrid}
            isLoading={grid.isLoading}
            teamId={teamId}
            onDeconvokePlayer={(playerId) => convocation.moveToNotCalled(playerId)}
            currentNotCalled={convocation.mgmtNotCalled}
          />
        )}

        {/* "Ver convocatoria" dialog — on-screen version of the WhatsApp export */}
        <ConvocationDetailsDialog
          open={viewConvocationOpen}
          onClose={() => setViewConvocationOpen(false)}
          match={match}
          calledIds={convocation.mgmtCalled}
          notCalledIds={convocation.mgmtNotCalled}
          players={convocation.players}
          photos={convocation.mgmtPhotos}
          excuseMap={convocation.mgmtExcuseMap}
          excuseTypes={convocation.excuseTypes}
          kits={kits}
          selectedKitNumber={selectedKitNumber}
          teamId={teamId}
          canCopyToWhatsApp={coachAuthService.hasRole("Coach")}
          pendingIds={convocation.mgmtPending}
        />

        {/* PDF print container — off-screen, captured by html2canvas */}
        <ConvocatoriaPrint
          ref={printRef}
          match={match}
          calledIds={convocation.mgmtCalled}
          notCalledIds={convocation.mgmtNotCalled}
          proposal={proposal}
          players={convocation.players}
          photos={convocation.mgmtPhotos}
          excuseMap={convocation.mgmtExcuseMap}
          excuseTypes={convocation.excuseTypes}
          kits={kits}
          selectedKitNumber={selectedKitNumber}
        />
      </ContentLayout>
    </BaseLayout>
  );
}
