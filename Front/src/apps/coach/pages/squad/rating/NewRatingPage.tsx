import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Snackbar,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";

import BaseLayout from "../../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../../shared/components/ui/ContentLayout/ContentLayout";
import avatarFallback from "../../../../../assets/avatar.svg";
import { getTeamPlayerById } from "../../../services/teamplayerService";
import {
  createRating,
  getRatingHistory,
  type CharacteristicAnswer,
} from "../../../services/playerRatingService";
import {
  FIELD_PLAYER_CHARACTERISTICS,
  GOALKEEPER_CHARACTERISTICS,
  getCategoryLabel,
  type CategoryKey,
  type CharacteristicDef,
} from "./ratingConcepts";
import type { PlayerRating } from "../../../types/playerRating";

import styles from "./NewRatingPage.module.css";

function isGoalkeeperDemarcation(demarcation?: string | null): boolean {
  if (!demarcation) return false;
  const d = demarcation.toLowerCase();
  return d.includes("portero") || d.includes("keeper") || d.includes("arquero");
}

export default function NewRatingPage() {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const squadSearch = searchParams.toString() ? `?${searchParams.toString()}&tab=1` : "?tab=1";

  const [playerName, setPlayerName] = useState<string>("");
  const [playerDorsal, setPlayerDorsal] = useState<number | null>(null);
  const [playerPhoto, setPlayerPhoto] = useState<string | null>(null);
  const [isGoalkeeper, setIsGoalkeeper] = useState(false);
  const [loadingPlayer, setLoadingPlayer] = useState(true);
  const [answers, setAnswers] = useState<Record<string, CharacteristicAnswer>>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [latestRating, setLatestRating] = useState<PlayerRating | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" | "info" }>({ open: false, message: "", severity: "success" });

  useEffect(() => {
    if (!playerId) return;
    setLoadingPlayer(true);
    Promise.all([getTeamPlayerById(playerId), getRatingHistory(playerId)])
      .then(([tp, history]) => {
        if (tp) {
          const name = tp.player?.name ?? tp.player?.firstName
            ? `${tp.player?.firstName ?? ""} ${tp.player?.lastName ?? ""}`.trim()
            : tp.id;
          setPlayerName(name);
          setPlayerDorsal(tp.dorsal ?? tp.player?.dorsal ?? null);
          setPlayerPhoto(tp.player?.urlPhoto ?? null);

          const demarcation = tp.demarcation?.activePositionName ?? null;
          const goalkeeper = isGoalkeeperDemarcation(demarcation);
          setIsGoalkeeper(goalkeeper);

          const orderedHistory = [...history].sort(
            (a, b) => new Date(b.ratedAt).getTime() - new Date(a.ratedAt).getTime(),
          );
          const last = orderedHistory[0] ?? null;
          setLatestRating(last);

          if (last) {
            const validKeys = new Set(
              (goalkeeper ? GOALKEEPER_CHARACTERISTICS : FIELD_PLAYER_CHARACTERISTICS).map((c) => c.key),
            );
            const prefilled = last.answers
              .filter((a) => validKeys.has(a.characteristicKey))
              .reduce<Record<string, CharacteristicAnswer>>((acc, a) => {
                acc[a.characteristicKey] = {
                  characteristicKey: a.characteristicKey,
                  level: a.level,
                  concept: a.concept,
                  categoryKey: a.categoryKey,
                };
                return acc;
              }, {});
            setAnswers(prefilled);
            setNotes(last.notes ?? "");
          }
        }
      })
      .catch(() => {
        setSnackbar({ open: true, message: "No se pudo cargar la valoración previa", severity: "error" });
      })
      .finally(() => {
        setLoadingPlayer(false);
      });
  }, [playerId]);

  const characteristics: CharacteristicDef[] = isGoalkeeper
    ? GOALKEEPER_CHARACTERISTICS
    : FIELD_PLAYER_CHARACTERISTICS;

  const grouped = characteristics.reduce<Record<CategoryKey, CharacteristicDef[]>>(
    (acc, c) => {
      if (!acc[c.categoryKey]) acc[c.categoryKey] = [];
      acc[c.categoryKey].push(c);
      return acc;
    },
    {} as Record<CategoryKey, CharacteristicDef[]>,
  );

  const categoryKeys = Object.keys(grouped) as CategoryKey[];

  const selectedChar = selectedKey
    ? characteristics.find((c) => c.key === selectedKey) ?? null
    : null;

  useEffect(() => {
    if (selectedKey) return;
    if (characteristics.length === 0) return;
    setSelectedKey(characteristics[0].key);
  }, [characteristics, selectedKey]);

  const hasChanges = useMemo(() => {
    if (!latestRating) {
      return Object.keys(answers).length > 0 || notes.trim().length > 0;
    }

    const normalize = (list: CharacteristicAnswer[]) =>
      [...list]
        .map((a) => ({
          characteristicKey: a.characteristicKey,
          level: a.level,
          concept: a.concept,
          categoryKey: a.categoryKey,
        }))
        .sort((a, b) => a.characteristicKey.localeCompare(b.characteristicKey));

    const currentAnswers = normalize(Object.values(answers));
    const latestAnswers = normalize(
      latestRating.answers.map((a) => ({
        characteristicKey: a.characteristicKey,
        level: a.level,
        concept: a.concept,
        categoryKey: a.categoryKey,
      })),
    );

    return JSON.stringify(currentAnswers) !== JSON.stringify(latestAnswers)
      || notes.trim() !== (latestRating.notes ?? "").trim();
  }, [answers, latestRating, notes]);

  function selectLevel(level: number) {
    if (!selectedChar) return;
    const conceptLevel = selectedChar.levels[level - 1];
    setAnswers((prev) => ({
      ...prev,
      [selectedChar.key]: {
        characteristicKey: selectedChar.key,
        level,
        concept: conceptLevel.concept,
        categoryKey: selectedChar.categoryKey,
      },
    }));
  }

  const totalCharacteristics = characteristics.length;
  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === totalCharacteristics;

  async function handleSave() {
    if (!playerId) return;
    if (!hasChanges) {
      setSnackbar({ open: true, message: "No hay cambios para guardar", severity: "info" });
      return;
    }
    setSaving(true);
    try {
      await createRating(playerId, {
        isGoalkeeper,
        answers: Object.values(answers),
        notes: notes.trim() || null,
      });
      navigate(`/coach/squad${squadSearch}`);
    } catch {
      setSnackbar({ open: true, message: "Error al guardar la valoración", severity: "error" });
    } finally {
      setSaving(false);
    }
  }

  if (loadingPlayer) {
    return (
      <BaseLayout hideFooterMenu>
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
          <CircularProgress />
        </Box>
      </BaseLayout>
    );
  }

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title={latestRating ? "Editar valoración" : "Nueva valoración"}
        actionBar={
          <>
            <div className={styles.playerIdentity}>
              <div className={styles.playerAvatarWrap}>
                <img
                  src={playerPhoto ?? avatarFallback}
                  alt={playerName}
                  className={styles.playerAvatar}
                />
              </div>
              {playerDorsal != null && (
                <span className={styles.playerDorsal}>{playerDorsal}</span>
              )}
              <span className={styles.playerIdentityName}>{playerName}</span>
            </div>
            <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="caption" sx={{ opacity: 0.6 }}>
              {answeredCount} / {totalCharacteristics}
            </Typography>
            <Button size="small" variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(`/coach/squad${squadSearch}`)}>
              Volver
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<SaveIcon />}
              disabled={!allAnswered || saving}
              onClick={handleSave}
            >
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </Box>
          </>
        }
      >
        <div className={styles.splitLayout}>
          {/* ── Left panel: characteristics list ─── */}
          <div className={styles.leftPanel}>
            {categoryKeys.map((catKey) => (
              <div key={catKey} className={styles.categorySection}>
                <div className={styles.categoryHeader}>{getCategoryLabel(catKey)}</div>
                {grouped[catKey].map((char) => {
                  const answer = answers[char.key];
                  const isSelected = selectedKey === char.key;
                  return (
                    <button
                      key={char.key}
                      className={`${styles.charRow} ${isSelected ? styles.charRowSelected : ""} ${answer ? styles.charRowAnswered : ""}`}
                      onClick={() => setSelectedKey(char.key)}
                    >
                      <span className={styles.charLabel}>{char.label}</span>
                      {answer && (
                        <span className={styles.charLevelBadge}>Niv {answer.level}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* ── Right panel: level selector ─── */}
          <div className={styles.rightPanel}>
            {!selectedChar ? (
              <Typography sx={{ opacity: 0.5, mt: 4, textAlign: "center" }}>
                Selecciona una característica para valorarla
              </Typography>
            ) : (
              <div className={styles.conceptPanel}>
                <Typography variant="subtitle1" className={styles.conceptTitle}>
                  {selectedChar.label}
                </Typography>
                <div className={styles.conceptList}>
                  {selectedChar.levels.map((conceptLevel, idx) => {
                    const level = idx + 1;
                    const isActive = answers[selectedChar.key]?.level === level;
                    return (
                      <button
                        key={level}
                        className={`${styles.conceptPill} ${isActive ? styles.conceptPillActive : ""}`}
                        onClick={() => selectLevel(level)}
                      >
                        <span className={styles.conceptLevel}>{level}</span>
                        <span className={styles.conceptText}>{conceptLevel.concept}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className={styles.notesArea}>
              <TextField
                label="Notas (opcional)"
                multiline
                minRows={2}
                fullWidth
                size="small"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                inputProps={{ maxLength: 500 }}
              />
            </div>
          </div>
        </div>
      </ContentLayout>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </BaseLayout>
  );
}
