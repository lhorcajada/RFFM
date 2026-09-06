import { useEffect, useState } from "react";
import {
  Button,
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
import type { SimSlotPlayer } from "./SimulationPlayerSlot";
import type { GoalEventSubmitPayload } from "./GoalEventDialog";
import type { CardEventSubmitPayload } from "./CardEventDialog";
import GoalEventDialog from "./GoalEventDialog";
import CardEventDialog from "./CardEventDialog";
import styles from "./LiveMatchManualEditDialog.module.css";

interface ManualMinutes {
  [teamPlayerId: string]: string; // string so the input works uncontrolled
}

interface LiveMatchManualEditDialogProps {
  open: boolean;
  onClose: () => void;
  lineupPlayers: SquadPlayer[];
  /** Initial minutes per teamPlayerId */
  currentMinutes: Record<string, number>;
  onSaveMinutes: (overrides: Record<string, number>) => void;
  localTeamName: string;
  visitorTeamName: string;
  scoreLocal: number;
  scoreVisitor: number;
  /** Sets the final result directly, independent of the goals list (used when the
   * coach knows the score but not who scored or at what minute) */
  onSetScore: (scoreLocal: number, scoreVisitor: number) => void;
  goals: GoalEvent[];
  onAddGoal: (payload: GoalEventSubmitPayload, minute: number) => void;
  onUpdateGoal: (goalId: string, payload: GoalEventSubmitPayload, minute: number) => void;
  onRemoveGoal: (goalId: string) => void;
  cards: CardEvent[];
  onAddCard: (payload: CardEventSubmitPayload, minute: number, half: 1 | 2) => void;
  onUpdateCard: (cardId: string, payload: CardEventSubmitPayload, minute: number, half: 1 | 2) => void;
  onRemoveCard: (cardId: string) => void;
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
  goals,
  onAddGoal,
  onUpdateGoal,
  onRemoveGoal,
  cards,
  onAddCard,
  onUpdateCard,
  onRemoveCard,
}: LiveMatchManualEditDialogProps) {
  const [values, setValues] = useState<ManualMinutes>(() =>
    Object.fromEntries(lineupPlayers.map((p) => [p.id, String(currentMinutes[p.id] ?? 0)])),
  );
  const [error, setError] = useState<string | null>(null);
  const [scoreLocalInput, setScoreLocalInput] = useState(String(scoreLocal));
  const [scoreVisitorInput, setScoreVisitorInput] = useState(String(scoreVisitor));

  // Re-sync the form with the latest minutes/score every time the dialog is
  // opened, so it reflects previously saved data instead of a stale first-mount snapshot.
  useEffect(() => {
    if (!open) return;
    setValues(Object.fromEntries(lineupPlayers.map((p) => [p.id, String(currentMinutes[p.id] ?? 0)])));
    setScoreLocalInput(String(scoreLocal));
    setScoreVisitorInput(String(scoreVisitor));
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

  function handleChange(playerId: string, raw: string) {
    setValues((prev) => ({ ...prev, [playerId]: raw }));
    setError(null);
  }

  function handleSave() {
    const overrides: Record<string, number> = {};
    for (const [pid, raw] of Object.entries(values)) {
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
    onSaveMinutes(overrides);
    onSetScore(parsedScoreLocal, parsedScoreVisitor);
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
                    value={values[p.id] ?? "0"}
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
