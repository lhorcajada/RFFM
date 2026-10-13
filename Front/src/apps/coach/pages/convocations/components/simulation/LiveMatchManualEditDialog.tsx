import { useEffect, useMemo, useState } from "react";
import {
  Button,
  MenuItem,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Alert,
  IconButton,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import type { SquadPlayer } from "../../../squad/components/IdealLineup";
import type { GoalEvent, CardEvent } from "./liveMatch.types";
import { MAX_MATCH_DURATION_MINUTES } from "./liveMatch.types";
import type { SimSlotPlayer } from "./SimulationPlayerSlot";
import type { GoalEventSubmitPayload } from "./GoalEventDialog";
import type { CardEventSubmitPayload } from "./CardEventDialog";
import GoalEventDialog from "./GoalEventDialog";
import CardEventDialog from "./CardEventDialog";
import type { SubstitutionSwap, SubstitutionWindow } from "./simulation.types";
import {
  computeMinutesFromWindows,
  getWindowPeriod,
  rebuildWindows,
  type EditedWindow,
  type WindowPeriod,
} from "../../utils/substitutionWindowEdits";
import styles from "./LiveMatchManualEditDialog.module.css";

interface ManualMinutes {
  [teamPlayerId: string]: string; // string so the input works uncontrolled
}

/** A substitution window being corrected; the minute stays a string so the input works uncontrolled */
interface WindowDraft {
  sourceIndex: number;
  minute: string;
  period: WindowPeriod;
  swaps: SubstitutionSwap[];
}

const MAX_MINUTE = 200;
const NO_WINDOWS: SubstitutionWindow[] = [];
const NO_STARTERS: string[] = [];

const PERIOD_OPTIONS: { value: WindowPeriod; label: string }[] = [
  { value: "firstHalf", label: "1ª parte" },
  { value: "halftime", label: "Descanso" },
  { value: "secondHalf", label: "2ª parte" },
];

const windowFieldSx = {
  "& .MuiInputBase-input": { color: "#fff" },
  "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.7)" },
  "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.2)" },
  "& .MuiSelect-icon": { color: "rgba(255,255,255,0.7)" },
};

function toWindowDrafts(windows: SubstitutionWindow[]): WindowDraft[] {
  return windows.map((window, sourceIndex) => ({
    sourceIndex,
    minute: String(window.minute),
    period: getWindowPeriod(window),
    swaps: window.swaps.map((swap) => ({ ...swap })),
  }));
}

function parseWindowMinute(raw: string): number | null {
  const parsed = Number(raw);
  const isValid = raw.trim() !== "" && Number.isInteger(parsed) && parsed >= 0 && parsed <= MAX_MINUTE;
  return isValid ? parsed : null;
}

/** Score, duration and substitution windows as left in the dialog, handed to the save so it doesn't use stale values */
export interface ManualEditFinalValues {
  scoreLocal: number;
  scoreVisitor: number;
  matchDurationMinutes: number;
  windows: SubstitutionWindow[];
}

interface LiveMatchManualEditDialogProps {
  open: boolean;
  onClose: () => void;
  lineupPlayers: SquadPlayer[];
  /** Initial minutes per teamPlayerId */
  currentMinutes: Record<string, number>;
  onSaveMinutes: (overrides: Record<string, number>, finalValues: ManualEditFinalValues) => void;
  localTeamName: string;
  visitorTeamName: string;
  scoreLocal: number;
  scoreVisitor: number;
  /** Sets the final result directly, independent of the goals list (used when the
   * coach knows the score but not who scored or at what minute) */
  onSetScore: (scoreLocal: number, scoreVisitor: number) => void;
  /** Duración guardada del partido (null = aún no hay). */
  matchDurationMinutes: number | null;
  /** Duración propuesta cuando no hay una guardada (2 × minutos por parte). */
  defaultMatchDurationMinutes: number;
  onSetMatchDuration: (minutes: number) => void;
  goals: GoalEvent[];
  onAddGoal: (payload: GoalEventSubmitPayload, minute: number) => void;
  onUpdateGoal: (goalId: string, payload: GoalEventSubmitPayload, minute: number) => void;
  onRemoveGoal: (goalId: string) => void;
  cards: CardEvent[];
  onAddCard: (payload: CardEventSubmitPayload, minute: number, half: 1 | 2) => void;
  onUpdateCard: (cardId: string, payload: CardEventSubmitPayload, minute: number, half: 1 | 2) => void;
  onRemoveCard: (cardId: string) => void;
  /** Substitution windows recorded in the match */
  windows?: SubstitutionWindow[];
  /** Players who started the match; needed to recalculate minutes when a substitution is corrected */
  starterIds?: string[];
  onSetWindows?: (windows: SubstitutionWindow[]) => void;
}

export default function LiveMatchManualEditDialog({
  open,
  onClose,
  lineupPlayers,
  currentMinutes,
  onSaveMinutes,
  localTeamName,
  visitorTeamName,
  scoreLocal,
  scoreVisitor,
  onSetScore,
  matchDurationMinutes,
  defaultMatchDurationMinutes,
  onSetMatchDuration,
  goals,
  onAddGoal,
  onUpdateGoal,
  onRemoveGoal,
  cards,
  onAddCard,
  onUpdateCard,
  onRemoveCard,
  windows = NO_WINDOWS,
  starterIds = NO_STARTERS,
  onSetWindows,
}: LiveMatchManualEditDialogProps) {
  const [values, setValues] = useState<ManualMinutes>(() =>
    Object.fromEntries(lineupPlayers.map((p) => [p.id, String(currentMinutes[p.id] ?? 0)])),
  );
  const [error, setError] = useState<string | null>(null);
  const [scoreLocalInput, setScoreLocalInput] = useState(String(scoreLocal));
  const [scoreVisitorInput, setScoreVisitorInput] = useState(String(scoreVisitor));
  const initialDuration = () => String(matchDurationMinutes ?? defaultMatchDurationMinutes);
  const [durationInput, setDurationInput] = useState(initialDuration);
  const [windowDrafts, setWindowDrafts] = useState<WindowDraft[]>(() => toWindowDrafts(windows));
  // Part of the recalculated minutes a player already had when the coach typed their minutes by hand
  const [minuteOffsets, setMinuteOffsets] = useState<Record<string, number>>({});

  // Re-sync the form with the latest minutes/score every time the dialog is
  // opened, so it reflects previously saved data instead of a stale first-mount snapshot.
  useEffect(() => {
    if (!open) return;
    setValues(Object.fromEntries(lineupPlayers.map((p) => [p.id, String(currentMinutes[p.id] ?? 0)])));
    setScoreLocalInput(String(scoreLocal));
    setScoreVisitorInput(String(scoreVisitor));
    setDurationInput(initialDuration());
    setWindowDrafts(toWindowDrafts(windows));
    setMinuteOffsets({});
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Goal dialog state
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [goalDialogMode, setGoalDialogMode] = useState<"add" | "edit">("add");
  const [goalDialogIsOwnTeam, setGoalDialogIsOwnTeam] = useState(true);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [goalInitialValue, setGoalInitialValue] = useState<GoalEventSubmitPayload | undefined>();

  // Card dialog state
  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [cardDialogMode, setCardDialogMode] = useState<"add" | "edit">("add");
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [cardMinute, setCardMinute] = useState<string>("0");
  const [cardHalf, setCardHalf] = useState<1 | 2>(1);
  const [cardInitialValue, setCardInitialValue] = useState<CardEventSubmitPayload | undefined>();

  // Convert lineupPlayers to SimSlotPlayer[] for dialogs
  const simPlayers: SimSlotPlayer[] = lineupPlayers.map((p) => ({
    teamPlayerId: p.id,
    displayName: p.displayName,
    alias: p.alias,
    dorsal: p.dorsal,
  }));

  // While a minute is being typed (and is not valid yet) the window keeps its recorded minute
  function toEditedWindows(drafts: WindowDraft[]): EditedWindow[] {
    return drafts.map((draft) => ({
      sourceIndex: draft.sourceIndex,
      minute: parseWindowMinute(draft.minute) ?? windows[draft.sourceIndex].minute,
      period: draft.period,
      swaps: draft.swaps,
    }));
  }

  // Minutes each player gains or loses because of the corrections made to the substitutions
  const minutesDelta = useMemo(() => {
    const typedDuration = Number(durationInput);
    const duration =
      Number.isInteger(typedDuration) && typedDuration > 0
        ? typedDuration
        : matchDurationMinutes || defaultMatchDurationMinutes;
    const before = computeMinutesFromWindows(starterIds, windows, duration, cards);
    const after = computeMinutesFromWindows(
      starterIds,
      rebuildWindows(starterIds, windows, toEditedWindows(windowDrafts)),
      duration,
      cards,
    );
    const delta: Record<string, number> = {};
    for (const playerId of new Set([...Object.keys(before), ...Object.keys(after)])) {
      delta[playerId] = (after[playerId] ?? 0) - (before[playerId] ?? 0);
    }
    return delta;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowDrafts, windows, starterIds, cards, durationInput, matchDurationMinutes, defaultMatchDurationMinutes]);

  function minutesShown(playerId: string): string {
    const raw = values[playerId] ?? "0";
    const pendingDelta = (minutesDelta[playerId] ?? 0) - (minuteOffsets[playerId] ?? 0);
    const parsed = parseInt(raw, 10);
    if (pendingDelta === 0 || isNaN(parsed)) return raw;
    return String(Math.max(0, parsed + pendingDelta));
  }

  function handleChange(playerId: string, raw: string) {
    setValues((prev) => ({ ...prev, [playerId]: raw }));
    setMinuteOffsets((prev) => ({ ...prev, [playerId]: minutesDelta[playerId] ?? 0 }));
    setError(null);
  }

  function updateWindowDraft(sourceIndex: number, patch: Partial<Omit<WindowDraft, "sourceIndex">>) {
    setWindowDrafts((prev) => prev.map((draft) => (draft.sourceIndex === sourceIndex ? { ...draft, ...patch } : draft)));
    setError(null);
  }

  function updateSwap(draft: WindowDraft, swapIndex: number, patch: Partial<SubstitutionSwap>) {
    updateWindowDraft(draft.sourceIndex, {
      swaps: draft.swaps.map((swap, i) => (i === swapIndex ? { ...swap, ...patch } : swap)),
    });
  }

  function removeWindow(sourceIndex: number) {
    setWindowDrafts((prev) => prev.filter((draft) => draft.sourceIndex !== sourceIndex));
    setError(null);
  }

  function removeSwap(draft: WindowDraft, swapIndex: number) {
    const remainingSwaps = draft.swaps.filter((_, i) => i !== swapIndex);
    if (remainingSwaps.length === 0) {
      removeWindow(draft.sourceIndex);
      return;
    }
    updateWindowDraft(draft.sourceIndex, { swaps: remainingSwaps });
  }

  function findWindowsError(): string | null {
    for (const draft of windowDrafts) {
      if (parseWindowMinute(draft.minute) === null) {
        return `Revisa el minuto de las ventanas de cambios (debe ser un número entre 0 y ${MAX_MINUTE}).`;
      }
      const samePlayerInAndOut = draft.swaps.some((swap) => swap.inPlayerId === swap.outPlayerId);
      if (samePlayerInAndOut) {
        return "Revisa los cambios: un jugador no puede entrar y salir en el mismo cambio.";
      }
      const involvedIds = draft.swaps.flatMap((swap) => [swap.inPlayerId, swap.outPlayerId]).filter(Boolean);
      const playerRepeated = new Set(involvedIds).size !== involvedIds.length;
      if (playerRepeated) {
        return "Revisa los cambios: un jugador no puede aparecer dos veces en la misma ventana.";
      }
    }
    return null;
  }

  function handleSave() {
    const windowsError = findWindowsError();
    if (windowsError) {
      setError(windowsError);
      return;
    }
    const overrides: Record<string, number> = {};
    for (const pid of Object.keys(values)) {
      const raw = minutesShown(pid);
      const parsed = parseInt(raw, 10);
      if (isNaN(parsed) || parsed < 0 || parsed > 200) {
        setError("Revisa los minutos introducidos (deben ser números entre 0 y 200).");
        return;
      }
      overrides[pid] = parsed;
    }
    const parsedScoreLocal = parseInt(scoreLocalInput, 10);
    const parsedScoreVisitor = parseInt(scoreVisitorInput, 10);
    if (isNaN(parsedScoreLocal) || parsedScoreLocal < 0 || isNaN(parsedScoreVisitor) || parsedScoreVisitor < 0) {
      setError("Revisa el resultado introducido (deben ser números iguales o mayores a 0).");
      return;
    }
    const parsedDuration = Number(durationInput);
    const durationIsValid =
      durationInput.trim() !== "" && Number.isInteger(parsedDuration) && parsedDuration >= 0 && parsedDuration <= MAX_MATCH_DURATION_MINUTES;
    if (!durationIsValid) {
      setError(`Revisa la duración del partido (debe ser un número entre 0 y ${MAX_MATCH_DURATION_MINUTES}).`);
      return;
    }
    const correctedWindows = rebuildWindows(starterIds, windows, toEditedWindows(windowDrafts));
    onSaveMinutes(overrides, {
      scoreLocal: parsedScoreLocal,
      scoreVisitor: parsedScoreVisitor,
      matchDurationMinutes: parsedDuration,
      windows: correctedWindows,
    });
    onSetWindows?.(correctedWindows);
    onSetScore(parsedScoreLocal, parsedScoreVisitor);
    onSetMatchDuration(parsedDuration);
    onClose();
  }

  // Goal handlers
  function openAddGoalDialog(isOwnTeam: boolean) {
    setGoalDialogMode("add");
    setGoalDialogIsOwnTeam(isOwnTeam);
    setGoalInitialValue(undefined);
    setEditingGoalId(null);
    setGoalDialogOpen(true);
  }

  function openEditGoalDialog(goal: GoalEvent) {
    setGoalDialogMode("edit");
    setGoalDialogIsOwnTeam(goal.isOwnTeam);
    setGoalInitialValue(goal);
    setEditingGoalId(goal.id);
    setGoalDialogOpen(true);
  }

  function handleGoalSubmit(payload: GoalEventSubmitPayload) {
    setGoalDialogOpen(false);
    setError(null);

    if (goalDialogMode === "add") {
      onAddGoal(payload, payload.minute);
    } else if (editingGoalId) {
      onUpdateGoal(editingGoalId, payload, payload.minute);
    }
  }

  // Card handlers
  function openAddCardDialog() {
    setCardDialogMode("add");
    setCardMinute("0");
    setCardHalf(1);
    setCardInitialValue(undefined);
    setEditingCardId(null);
    setCardDialogOpen(true);
  }

  function openEditCardDialog(card: CardEvent) {
    setCardDialogMode("edit");
    setCardMinute(card.minute.toString());
    setCardHalf(card.half);
    setCardInitialValue(card);
    setEditingCardId(card.id);
    setCardDialogOpen(true);
  }

  function handleCardSubmit(payload: CardEventSubmitPayload) {
    const parsed = parseInt(cardMinute, 10);
    if (isNaN(parsed) || parsed < 0 || parsed > 200) {
      setError("Revisa los minutos introducidos (deben ser números entre 0 y 200).");
      return;
    }
    setCardDialogOpen(false);
    setError(null);

    if (cardDialogMode === "add") {
      onAddCard(payload, parsed, cardHalf);
    } else if (editingCardId) {
      onUpdateCard(editingCardId, payload, parsed, cardHalf);
    }
  }

  function playerLabel(player: SquadPlayer): string {
    const name = player.alias?.trim() || player.displayName.split(" ").slice(0, 2).join(" ");
    return player.dorsal != null ? `${player.dorsal} · ${name}` : name;
  }

  function renderPlayerSelect(id: string, label: string, playerId: string, onSelect: (playerId: string) => void) {
    const isInLineup = lineupPlayers.some((p) => p.id === playerId);
    return (
      <TextField
        id={id}
        select
        size="small"
        label={label}
        value={playerId}
        onChange={(e) => onSelect(e.target.value)}
        className={styles.swapPlayerField}
        sx={windowFieldSx}
      >
        {!isInLineup && <MenuItem value={playerId}>Jugador no convocado</MenuItem>}
        {lineupPlayers.map((p) => (
          <MenuItem key={p.id} value={p.id}>
            {playerLabel(p)}
          </MenuItem>
        ))}
      </TextField>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{ sx: { bgcolor: "#19192e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 3 } }}
    >
      <DialogTitle
        sx={{ color: "#fff", fontSize: "0.95rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}
      >
        <EditIcon sx={{ fontSize: 18, color: "#fb923c" }} />
        Edición manual del partido
      </DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 1 }}>
            {error}
          </Alert>
        )}

        {/* Result section — lets the coach set the final score directly,
            without needing to know who scored or at what minute. */}
        <div>
          <div className={styles.sectionTitle}>Resultado</div>
          <div className={styles.scoreRow}>
            <span className={styles.scoreTeamName}>{localTeamName}</span>
            <TextField
              size="small"
              type="number"
              inputProps={{ min: 0, step: 1 }}
              value={scoreLocalInput}
              onChange={(e) => setScoreLocalInput(e.target.value)}
              sx={{
                width: 70,
                "& .MuiInputBase-input": { color: "#fff", textAlign: "center" },
                "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.2)" },
              }}
            />
            <span className={styles.scoreSep}>-</span>
            <TextField
              size="small"
              type="number"
              inputProps={{ min: 0, step: 1 }}
              value={scoreVisitorInput}
              onChange={(e) => setScoreVisitorInput(e.target.value)}
              sx={{
                width: 70,
                "& .MuiInputBase-input": { color: "#fff", textAlign: "center" },
                "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.2)" },
              }}
            />
            <span className={styles.scoreTeamName}>{visitorTeamName}</span>
          </div>
          <TextField
            id="match-duration-minutes"
            size="small"
            type="number"
            label="Duración del partido (min)"
            helperText="Si lo dejas en 0 se usa la duración de la categoría"
            inputProps={{ min: 0, max: MAX_MATCH_DURATION_MINUTES, step: 1 }}
            value={durationInput}
            onChange={(e) => {
              setDurationInput(e.target.value);
              setError(null);
            }}
            className={styles.durationField}
            sx={{
              "& .MuiInputBase-input": { color: "#fff" },
              "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.7)" },
              "& .MuiFormHelperText-root": { color: "rgba(255,255,255,0.55)" },
              "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.2)" },
            }}
          />
        </div>

        {/* Substitution windows section — corrections here recalculate the minutes below */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Ventanas de cambios ({windowDrafts.length})</div>
          {windowDrafts.length > 0 && (
            <div className={styles.sectionHint}>
              Al corregir un cambio se recalculan los minutos de los jugadores afectados.
            </div>
          )}
          <div className={styles.itemsList}>
            {windowDrafts.map((draft) => {
              const fieldId = `substitution-window-${draft.sourceIndex}`;
              return (
                <div key={draft.sourceIndex} className={styles.windowCard}>
                  <div className={styles.windowHeader}>
                    <TextField
                      id={`${fieldId}-minute`}
                      size="small"
                      type="number"
                      label="Minuto"
                      inputProps={{ min: 0, max: MAX_MINUTE, step: 1 }}
                      value={draft.minute}
                      onChange={(e) => updateWindowDraft(draft.sourceIndex, { minute: e.target.value })}
                      className={styles.windowMinuteField}
                      sx={windowFieldSx}
                    />
                    <TextField
                      id={`${fieldId}-period`}
                      select
                      size="small"
                      label="Parte"
                      value={draft.period}
                      onChange={(e) => updateWindowDraft(draft.sourceIndex, { period: e.target.value as WindowPeriod })}
                      className={styles.windowPeriodField}
                      sx={windowFieldSx}
                    >
                      {PERIOD_OPTIONS.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </TextField>
                    <IconButton
                      size="small"
                      aria-label="Eliminar ventana"
                      onClick={() => removeWindow(draft.sourceIndex)}
                      sx={{ color: "#ef4444", marginLeft: "auto" }}
                    >
                      <DeleteIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </div>
                  {draft.swaps.map((swap, swapIndex) => (
                    <div key={swapIndex} className={styles.swapRow}>
                      {renderPlayerSelect(`${fieldId}-swap-${swapIndex}-in`, "Entra", swap.inPlayerId, (playerId) =>
                        updateSwap(draft, swapIndex, { inPlayerId: playerId }),
                      )}
                      {swap.outPlayerId !== null ? (
                        renderPlayerSelect(`${fieldId}-swap-${swapIndex}-out`, "Sale", swap.outPlayerId, (playerId) =>
                          updateSwap(draft, swapIndex, { outPlayerId: playerId }),
                        )
                      ) : (
                        <span className={styles.swapNoOut}>Ocupa un puesto libre</span>
                      )}
                      <IconButton
                        size="small"
                        aria-label="Eliminar cambio"
                        onClick={() => removeSwap(draft, swapIndex)}
                        sx={{ color: "#ef4444" }}
                      >
                        <DeleteIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </div>
                  ))}
                </div>
              );
            })}
            {windowDrafts.length === 0 && <div className={styles.emptyMessage}>No hay cambios registrados</div>}
          </div>
        </div>

        {/* Minutes section */}
        <div>
          <div className={styles.sectionTitle}>Minutos</div>
          <div className={styles.grid}>
            {lineupPlayers.map((p) => {
              const name = p.alias?.trim() || p.displayName.split(" ").slice(0, 2).join(" ");
              return (
                <div key={p.id} className={styles.row}>
                  {p.dorsal != null && (
                    <span className={styles.dorsal}>{p.dorsal}</span>
                  )}
                  <span className={styles.name}>{name}</span>
                  <TextField
                    size="small"
                    type="number"
                    inputProps={{ min: 0, max: 200, step: 1 }}
                    value={minutesShown(p.id)}
                    onChange={(e) => handleChange(p.id, e.target.value)}
                    sx={{
                      width: 80,
                      "& .MuiInputBase-input": { color: "#fff", textAlign: "center" },
                      "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.2)" },
                    }}
                  />
                  <span className={styles.minLabel}>min</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Goals section */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>Goles ({goals.length})</div>
            <div className={styles.sectionHeaderActions}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<AddIcon sx={{ fontSize: 16 }} />}
                onClick={() => openAddGoalDialog(true)}
              >
                Gol propio
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="error"
                startIcon={<AddIcon sx={{ fontSize: 16 }} />}
                onClick={() => openAddGoalDialog(false)}
              >
                Gol rival
              </Button>
            </div>
          </div>
          <div className={styles.itemsList}>
            {goals.map((goal) => (
              <div key={goal.id} className={styles.item}>
                <div className={styles.itemContent}>
                  <span className={styles.itemMinute}>{goal.minute}'</span>
                  <span className={styles.itemText}>
                    {goal.scorerName || "Rival"}
                  </span>
                </div>
                <div className={styles.itemActions}>
                  <IconButton
                    size="small"
                    onClick={() => openEditGoalDialog(goal)}
                    sx={{ color: "#fb923c" }}
                  >
                    <EditIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => onRemoveGoal(goal.id)}
                    sx={{ color: "#ef4444" }}
                  >
                    <DeleteIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </div>
              </div>
            ))}
            {goals.length === 0 && (
              <div className={styles.emptyMessage}>No hay goles registrados</div>
            )}
          </div>
        </div>

        {/* Cards section */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>Tarjetas ({cards.length})</div>
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddIcon sx={{ fontSize: 16 }} />}
              onClick={openAddCardDialog}
            >
              Añadir tarjeta
            </Button>
          </div>
          <div className={styles.itemsList}>
            {cards.map((card) => (
              <div key={card.id} className={styles.item}>
                <div className={styles.itemContent}>
                  <span className={styles.itemMinute}>{card.minute}'</span>
                  <span className={styles.itemText}>
                    {card.playerName || "Rival"} - {card.cardType === "yellow" ? "Amarilla" : "Roja"}
                  </span>
                </div>
                <div className={styles.itemActions}>
                  <IconButton
                    size="small"
                    onClick={() => openEditCardDialog(card)}
                    sx={{ color: "#fb923c" }}
                  >
                    <EditIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => onRemoveCard(card.id)}
                    sx={{ color: "#ef4444" }}
                  >
                    <DeleteIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </div>
              </div>
            ))}
            {cards.length === 0 && (
              <div className={styles.emptyMessage}>No hay tarjetas registradas</div>
            )}
          </div>
        </div>
      </DialogContent>

      <GoalEventDialog
        open={goalDialogOpen}
        players={simPlayers}
        isOwnTeam={goalDialogIsOwnTeam}
        onClose={() => setGoalDialogOpen(false)}
        onSubmit={handleGoalSubmit}
        initialValue={goalDialogMode === "edit" ? goalInitialValue : undefined}
      />

      <CardEventDialog
        open={cardDialogOpen}
        players={simPlayers}
        onClose={() => setCardDialogOpen(false)}
        onSubmit={handleCardSubmit}
        initialValue={cardDialogMode === "edit" ? cardInitialValue : undefined}
      />

      <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
        <Button onClick={onClose} color="inherit" size="small">
          Cancelar
        </Button>
        <Button onClick={handleSave} variant="contained" size="small">
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
