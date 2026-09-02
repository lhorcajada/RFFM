import { useEffect, useRef, useState, useMemo, useCallback } from "react";
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
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import configurationCoachService from "../../services/configurationCoachService";
import { getSportEventById } from "../../services/sportEventService";
import type { IdealLineupHandle } from "../squad/components/IdealLineup";
import ConvocationTab from "./components/ConvocationTab";
import DesconvocatoriasTab from "./components/DesconvocatoriasTab";
import AlineacionTab from "./components/AlineacionTab";
import SimulacionTab from "./components/SimulacionTab";
import PartidoEnDirectoTab from "./components/PartidoEnDirectoTab";
import ConvocatoriaPrint, { type ConvocatoriaPrintHandle } from "./components/ConvocatoriaPrint";
import type { MatchState } from "./components/convocationMatchDetail.types";
import { useConvocationManagement } from "./hooks/useConvocationManagement";
import { useDesconvocatoriasGrid } from "./hooks/useDesconvocatoriasGrid";
import { useConvocationMatchContext } from "./hooks/useConvocationMatchContext";
import { useConvocationPlayerViews } from "./hooks/useConvocationPlayerViews";
import { useConvocationProposal } from "./hooks/useConvocationProposal";
import type { ClubKit } from "../../services/kitService";
import { getTeamKits, updateEventKit } from "../../services/kitService";
import styles from "./ConvocationMatchDetail.module.css";
import ConvocationMatchHeader from "./components/ConvocationMatchHeader";
import ConvocationMatchActionBar from "./components/ConvocationMatchActionBar";
import ConvocationDeconvokeDialog from "./components/ConvocationDeconvokeDialog";

export default function ConvocationMatchDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const match = (location.state as { match?: MatchState } | null)?.match ?? null;

  // Team ID  from URL or fallback to coach configuration
  const params = new URLSearchParams(location.search);
  const [teamId, setTeamId] = useState(params.get("teamId") ?? "");
  const seasonId = params.get("seasonId");
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

  const [tab, setTab] = useState(1);
  // Desconvocatorias (0) y Convocatoria (2) son las únicas pestañas que necesitan el grid
  // histórico de convocatorias; una vez visitadas, se mantiene cargado al cambiar de pestaña.
  const needsGridData = tab === 0 || tab === 2;
  const [gridEnabled, setGridEnabled] = useState(needsGridData);
  useEffect(() => {
    if (needsGridData) setGridEnabled(true);
  }, [needsGridData]);
  // La propuesta de convocatoria (temporada, lesiones, starts, entrenos) solo la usa
  // la pestaña Convocatoria; se activa la primera vez que se visita y se mantiene.
  const needsProposalData = tab === 2;
  const [proposalEnabled, setProposalEnabled] = useState(needsProposalData);
  useEffect(() => {
    if (needsProposalData) setProposalEnabled(true);
  }, [needsProposalData]);
  const lineupRef = useRef<IdealLineupHandle>(null);
  const [lineupSaving, setLineupSaving] = useState(false);

  // Deconvoke reason dialog (Alineación tab)
  const [pendingDeconvokeId, setPendingDeconvokeId] = useState<string | null>(null);
  const [pendingDeconvokeExcuse, setPendingDeconvokeExcuse] = useState<number | "">("");

  const handleDeconvokeRequest = useCallback((playerId: string) => {
    setPendingDeconvokeExcuse("");
    setPendingDeconvokeId(playerId);
  }, []);

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

  // WhatsApp copy
  const [whatsappCopied, setWhatsappCopied] = useState(false);
  const [whatsappCopying, setWhatsappCopying] = useState(false);
  const handleWhatsAppCopy = useCallback(async () => {
    if (whatsappCopying) return;
    setWhatsappCopying(true);
    try {
      const ok = await printRef.current?.copyForWhatsApp();
      if (ok) {
        setWhatsappCopied(true);
        setTimeout(() => setWhatsappCopied(false), 2500);
      }
    } finally {
      setWhatsappCopying(false);
    }
  }, [whatsappCopying]);

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

  // Sport event category — used to enable unlimited substitution windows on friendlies
  const [isFriendly, setIsFriendly] = useState(false);

  // Data hooks
  const convocation = useConvocationManagement(teamId, match?.date);

  useEffect(() => {
    if (!convocation.mgmtEventId) return;
    let mounted = true;
    getSportEventById(convocation.mgmtEventId)
      .then((event) => {
        if (!mounted) return;
        setIsFriendly(event?.matchCategory === "Friendly");
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
    weekTrainingStatsMap,
    weekTrainingCount,
    loadingProposalContext,
  } = useConvocationMatchContext(teamId, match?.date, seasonId, convocation.players, proposalEnabled);

  const {
    playerStreaks,
    playerTechnicalTotals,
    lineupPlayers,
    notCalledPlayers,
    pendingPlayers,
  } = useConvocationPlayerViews({
    players: convocation.players,
    mgmtNotCalled: convocation.mgmtNotCalled,
    mgmtPending: convocation.mgmtPending,
    mgmtPhotos: convocation.mgmtPhotos,
    mgmtRatings: convocation.mgmtRatings,
    matchColumns: grid.matchColumns,
    enrichedGrid: grid.enrichedGrid,
  });

  const handleDeconvokeConfirm = useCallback(async () => {
    if (!pendingDeconvokeId || !pendingDeconvokeExcuse) return;
    const pid = pendingDeconvokeId;
    const excuseId = pendingDeconvokeExcuse as number;
    setPendingDeconvokeId(null);
    await convocation.moveToNotCalled(pid, excuseId);
  }, [pendingDeconvokeId, pendingDeconvokeExcuse, convocation]);

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

  const proposalRivalName = useMemo(() => {
    if (!match) return null;
    return match.isHomeTeam ? match.visitorTeamName : match.localTeamName;
  }, [match]);

  const proposal = useConvocationProposal({
    players: convocation.players,
    calledIds: convocation.mgmtCalled,
    ratings: convocation.mgmtRatings,
    playerStreaks,
    playerTechnicalTotals,
    seasonEvents: seasonEvents as any,
    seasonColumns: grid.matchColumns,
    enrichedGrid: grid.enrichedGrid,
    seasonStats,
    lastInjuryEndMap,
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
      for (const id of ids) {
        await convocation.moveToNotCalled(id, technicalExcuseId);
      }
    },
    [convocation],
  );
  const matchTitle = (
    <ConvocationMatchHeader
      match={match}
      kits={kits}
      selectedKitNumber={selectedKitNumber}
      onSelectKit={handleKitSelect}
      disabled={kitUpdating || !convocation.mgmtEventId}
    />
  );

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title={matchTitle}
        actionBar={
          <ConvocationMatchActionBar
            teamId={teamId}
            tab={tab}
            eventId={convocation.mgmtEventId}
            lineupPlayersCount={lineupPlayers.length}
            printing={printing}
            whatsappCopying={whatsappCopying}
            whatsappCopied={whatsappCopied}
            onBack={() => navigate(`/coach/convocations${teamId ? `?teamId=${teamId}` : ""}`)}
            onOpenEvent={() => navigate(`/coach/attendance/${convocation.mgmtEventId}`)}
            onSaveConvocation={convocation.handleSave}
            onSaveLineup={() => lineupRef.current?.save()}
            onPrint={handlePrint}
            onWhatsAppCopy={handleWhatsAppCopy}
          />
        }
      >
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
          <Tab label="Desconvocatorias" />
          <Tab label="Alineación" />
          <Tab label="Convocatoria" />
          <Tab label="Simular Partido" />
          <Tab label="Partido en Directo" />
        </Tabs>

        {/* Tab 2: Convocatoria */}
        {tab === 2 && (
          <ConvocationTab
            mgmtEventId={convocation.mgmtEventId}
            mgmtLoadingConv={convocation.mgmtLoadingConv}
            loadingPlayers={convocation.loadingPlayers}
            teamAvgRating={convocation.teamAvgRating}
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

        {/* Tab 0: Desconvocatorias */}
        {tab === 0 && (
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

        {/* Tab 1: Alineacion */}
        {tab === 1 && (
          <AlineacionTab
            mgmtEventId={convocation.mgmtEventId}
            lineupPlayers={lineupPlayers}
            notCalledPlayers={notCalledPlayers}
            pendingPlayers={pendingPlayers}
            lineupRef={lineupRef}
            teamId={teamId}
            onSavingChange={setLineupSaving}
            onDeconvoke={handleDeconvokeRequest}
            onReconvoke={(playerId) => convocation.moveToAvailable(playerId)}
            onAcceptPending={(playerId) => convocation.acceptPending(playerId)}
          />
        )}

        {/* Tab 3: Simular Partido */}
        {tab === 3 && (
          <SimulacionTab
            teamId={teamId}
            eventId={convocation.mgmtEventId}
            lineupPlayers={lineupPlayers}
          />
        )}

        {/* Tab 4: Partido en Directo */}
        {tab === 4 && (
          <PartidoEnDirectoTab
            teamId={teamId}
            eventId={convocation.mgmtEventId}
            lineupPlayers={lineupPlayers}
            localTeamName={match?.localTeamName ?? "Local"}
            localTeamShield={match?.localTeamShield ?? null}
            visitorTeamName={match?.visitorTeamName ?? "Visitante"}
            visitorTeamShield={match?.visitorTeamShield ?? null}
            isHomeTeam={match?.isHomeTeam ?? true}
            isFriendly={isFriendly}
          />
        )}

        {/* Deconvoke reason dialog */}
        <ConvocationDeconvokeDialog
          open={pendingDeconvokeId !== null}
          excuseTypes={convocation.excuseTypes}
          value={pendingDeconvokeExcuse}
          onClose={() => setPendingDeconvokeId(null)}
          onChange={(value) => setPendingDeconvokeExcuse(value)}
          onConfirm={handleDeconvokeConfirm}
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
