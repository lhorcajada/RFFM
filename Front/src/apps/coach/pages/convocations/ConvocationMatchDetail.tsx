import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Slide,
  Snackbar,
  Tab,
  Tabs,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import configurationCoachService from "../../services/configurationCoachService";
import type { IdealLineupHandle } from "../squad/components/IdealLineup";
import ConvocationTab from "./components/ConvocationTab";
import DesconvocatoriasTab from "./components/DesconvocatoriasTab";
import AlineacionTab from "./components/AlineacionTab";
import SimulacionTab from "./components/SimulacionTab";
import PartidoEnDirectoTab from "./components/PartidoEnDirectoTab";
import KitSelector from "./components/KitSelector/KitSelector";
import ConvocatoriaPrint, { type ConvocatoriaPrintHandle } from "./components/ConvocatoriaPrint";
import type { MatchState } from "./components/convocationMatchDetail.types";
import { useConvocationManagement } from "./hooks/useConvocationManagement";
import { useDesconvocatoriasGrid } from "./hooks/useDesconvocatoriasGrid";
import type { ClubKit } from "../../services/kitService";
import { getTeamKits, updateEventKit } from "../../services/kitService";
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

  const [tab, setTab] = useState(1);
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

  // Data hooks
  const convocation = useConvocationManagement(teamId, match?.date);
  const grid = useDesconvocatoriasGrid(teamId);

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

  // Per-player streak: consecutive past matches since the last "Decisión técnica" deconvocation
  const playerStreaks = useMemo(() => {
    const result = new Map<string, number>();
    const NOT_CALLED_NAMES = new Set(["Deconvoke", "No disponible"]);
    for (const player of convocation.players) {
      let streak = 0;
      for (const col of grid.matchColumns) {
        const cell = grid.enrichedGrid.get(col.eventId)?.get(player.id);
        if (cell && NOT_CALLED_NAMES.has(cell.statusName)) {
          const isTechDecision =
            !cell.excuseTypeId || !!cell.excuseName?.toLowerCase().includes("decisi");
          if (isTechDecision) break;
        }
        streak++;
      }
      result.set(player.id, streak);
    }
    return result;
  }, [convocation.players, grid.matchColumns, grid.enrichedGrid]);

  // Per-player total technical-decision deconvocations
  const playerTechnicalTotals = useMemo(() => {
    const NOT_CALLED_NAMES = new Set(["Deconvoke", "No disponible"]);
    const result = new Map<string, number>();
    for (const player of convocation.players) {
      let total = 0;
      for (const col of grid.matchColumns) {
        const cell = grid.enrichedGrid.get(col.eventId)?.get(player.id);
        if (cell && NOT_CALLED_NAMES.has(cell.statusName) && cell.statusName !== "No disponible") {
          const isTech = !cell.excuseTypeId || !!cell.excuseName?.toLowerCase().includes("decisi");
          if (isTech) total++;
        }
      }
      result.set(player.id, total);
    }
    return result;
  }, [convocation.players, grid.matchColumns, grid.enrichedGrid]);

  // Players for the Alineacion tab (accepted non-injured players only)
  const lineupPlayers = useMemo(() => {
    const notCalledSet = new Set(convocation.mgmtNotCalled);
    const pendingSet = new Set(convocation.mgmtPending);
    return convocation.players
      .filter((p) => p.isInjured !== true && !notCalledSet.has(p.id) && !pendingSet.has(p.id))
      .map((p) => ({
        id: p.id,
        displayName: p.alias || ((p.name ?? "") + " " + (p.lastName ?? "")).trim() || "Jugador",
        alias: p.alias ?? null,
        photoSrc: convocation.mgmtPhotos[p.id] ?? null,
        dorsal: p.dorsal ?? null,
        position: p.position ?? null,
        competitiveness: convocation.mgmtRatings[p.id]?.competitiveness ?? null,
        isInjured: false,
        streakCount: playerStreaks.get(p.id) ?? null,
        technicalTotal: playerTechnicalTotals.get(p.id) ?? null,
      }));
  }, [
    convocation.players,
    convocation.mgmtNotCalled,
    convocation.mgmtPending,
    convocation.mgmtPhotos,
    convocation.mgmtRatings,
    playerStreaks,
    playerTechnicalTotals,
  ]);

  const notCalledPlayers = useMemo(() => {
    const notCalledSet = new Set(convocation.mgmtNotCalled);
    return convocation.players
      .filter((p) => notCalledSet.has(p.id))
      .map((p) => ({
        id: p.id,
        displayName: p.alias || ((p.name ?? "") + " " + (p.lastName ?? "")).trim() || "Jugador",
        alias: p.alias ?? null,
        photoSrc: convocation.mgmtPhotos[p.id] ?? null,
        dorsal: p.dorsal ?? null,
        position: p.position ?? null,
        competitiveness: convocation.mgmtRatings[p.id]?.competitiveness ?? null,
        isInjured: p.isInjured ?? false,
        streakCount: playerStreaks.get(p.id) ?? null,
        technicalTotal: playerTechnicalTotals.get(p.id) ?? null,
      }));
  }, [
    convocation.players,
    convocation.mgmtNotCalled,
    convocation.mgmtPhotos,
    convocation.mgmtRatings,
    playerStreaks,
    playerTechnicalTotals,
  ]);

  const pendingPlayers = useMemo(() => {
    const pendingSet = new Set(convocation.mgmtPending);
    return convocation.players
      .filter((p) => pendingSet.has(p.id))
      .map((p) => ({
        id: p.id,
        displayName: p.alias || ((p.name ?? "") + " " + (p.lastName ?? "")).trim() || "Jugador",
        alias: p.alias ?? null,
        photoSrc: convocation.mgmtPhotos[p.id] ?? null,
        dorsal: p.dorsal ?? null,
        position: p.position ?? null,
        competitiveness: convocation.mgmtRatings[p.id]?.competitiveness ?? null,
        isInjured: false,
        streakCount: playerStreaks.get(p.id) ?? null,
        technicalTotal: playerTechnicalTotals.get(p.id) ?? null,
      }));
  }, [
    convocation.players,
    convocation.mgmtPending,
    convocation.mgmtPhotos,
    convocation.mgmtRatings,
    playerStreaks,
    playerTechnicalTotals,
  ]);

  const matchTitle = match ? (
    <div className={styles.titleWrap}>
      <span className={styles.convocationLabel}>Convocatoria</span>

      {/* Teams + time */}
      <div className={styles.matchInfoRow}>
        <div className={styles.matchTeamBlock}>
          {match.localTeamShield && (
            <img
              src={match.localTeamShield}
              alt=""
              className={styles.matchShield}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <span className={styles.matchTeamName}>{match.localTeamName}</span>
        </div>
        <span className={styles.matchTime}>{match.time || "--:--"}</span>
        <div className={`${styles.matchTeamBlock} ${styles.matchTeamBlockVisitor}`}>
          <span className={styles.matchTeamName}>{match.visitorTeamName}</span>
          {match.visitorTeamShield && (
            <img
              src={match.visitorTeamShield}
              alt=""
              className={styles.matchShield}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          )}
        </div>
      </div>

      {/* Date + field */}
      <div className={styles.matchMeta}>
        <span className={styles.matchDateLabel}>{match.date}</span>
        {match.field && (
          <>
            <span className={styles.matchMetaSep}>·</span>
            <span className={styles.matchField}>{match.field}</span>
          </>
        )}
      </div>

      {/* Kit selector */}
      {kits.length > 0 && (
        <KitSelector
          kits={kits}
          selectedKitNumber={selectedKitNumber}
          onSelect={handleKitSelect}
          disabled={kitUpdating || !convocation.mgmtEventId}
        />
      )}
    </div>
  ) : "Convocatoria";

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title={matchTitle}
        actionBar={
          <>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate(`/coach/convocations${teamId ? `?teamId=${teamId}` : ""}`)}
              variant="outlined"
              size="small"
            >
              Volver
            </Button>
            {convocation.mgmtEventId && (
              <Button
                startIcon={<PeopleAltIcon />}
                variant="outlined"
                size="small"
                onClick={() => navigate(`/coach/attendance/${convocation.mgmtEventId}`)}
              >
                Ir al evento
              </Button>
            )}
            {tab === 2 && convocation.mgmtEventId && (
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
            {tab === 1 && convocation.mgmtEventId && lineupPlayers.length > 0 && (
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
            {match && (
              <Button
                variant="outlined"
                size="small"
                startIcon={
                  printing ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : (
                    <PictureAsPdfIcon />
                  )
                }
                disabled={printing}
                onClick={handlePrint}
              >
                PDF
              </Button>
            )}
            {match && (
              <Button
                variant="outlined"
                size="small"
                startIcon={
                  whatsappCopying ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : whatsappCopied ? (
                    <CheckIcon />
                  ) : (
                    <WhatsAppIcon />
                  )
                }
                disabled={whatsappCopying}
                onClick={handleWhatsAppCopy}
                sx={{
                  borderColor: whatsappCopied ? "#4caf50" : "#25D366",
                  color: whatsappCopied ? "#4caf50" : "#25D366",
                  "&:hover": {
                    borderColor: whatsappCopied ? "#4caf50" : "#25D366",
                    backgroundColor: "rgba(37,211,102,0.08)",
                  },
                }}
              >
                {whatsappCopied ? (
                  <>
                    <ContentCopyIcon sx={{ fontSize: 14, mr: 0.5 }} />
                    ¡Copiado!
                  </>
                ) : (
                  "WhatsApp"
                )}
              </Button>
            )}

          </>
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
          />
        )}

        {/* Deconvoke reason dialog */}
        <Dialog
          open={pendingDeconvokeId !== null}
          onClose={() => setPendingDeconvokeId(null)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>Motivo de desconvocatoria</DialogTitle>
          <DialogContent>
            <FormControl fullWidth sx={{ mt: 1 }}>
              <InputLabel id="deconvoke-reason-label">Motivo</InputLabel>
              <Select
                labelId="deconvoke-reason-label"
                label="Motivo"
                value={pendingDeconvokeExcuse}
                onChange={(e) => setPendingDeconvokeExcuse(e.target.value as number)}
              >
                {convocation.excuseTypes.map((et) => (
                  <MenuItem key={et.id} value={et.id}>
                    {et.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPendingDeconvokeId(null)}>Cancelar</Button>
            <Button
              variant="contained"
              disabled={!pendingDeconvokeExcuse}
              onClick={handleDeconvokeConfirm}
            >
              Desconvocar
            </Button>
          </DialogActions>
        </Dialog>

        {/* PDF print container — off-screen, captured by html2canvas */}
        <ConvocatoriaPrint
          ref={printRef}
          match={match}
          calledIds={convocation.mgmtCalled}
          notCalledIds={convocation.mgmtNotCalled}
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
