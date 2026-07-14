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

import { usePermissions } from "../../../../../shared/hooks/usePermissions";
import BaseLayout from "../../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../../shared/components/ui/ContentLayout/ContentLayout";
import avatarFallback from "../../../../../assets/avatar.svg";
import { getTeamPlayerById } from "../../../services/teamplayerService";
import { fetchPlayerPhoto } from "../../../services/playerService";
import {
  createRating,
  getRatingHistory,
  getTeamLatestRatings,
  type CharacteristicAnswer,
} from "../../../services/playerRatingService";
import { getPlayersByTeam } from "../../../services/teamplayerService";
import {
  FIELD_PLAYER_CHARACTERISTICS,
  GOALKEEPER_CHARACTERISTICS,
  getCategoryLabel,
  type CategoryKey,
  type CharacteristicDef,
} from "./ratingConcepts";
import type { PlayerRating } from "../../../types/playerRating";
import { getAnswerLevel } from "../../../types/playerRating";
import type { PlayerResponse } from "../../../services/teamplayerService";

import styles from "./NewRatingPage.module.css";

function isGoalkeeperDemarcation(demarcation?: string | null): boolean {
  if (!demarcation) return false;
  const d = demarcation.toLowerCase();
  return d.includes("portero") || d.includes("keeper") || d.includes("arquero");
}

function positionCategory(position?: string | null): number {
  const normalized = (position ?? "").toLowerCase();
  if (!normalized) return 4;
  if (normalized.includes("portero") || normalized.includes("keeper") || normalized.includes("arquero")) return 0;
  if (
    normalized.includes("defensa") || normalized.includes("central") || normalized.includes("lateral") ||
    normalized.includes("libero") || normalized.includes("stopper")
  ) return 1;
  if (
    normalized.includes("centrocampista") || normalized.includes("medio") || normalized.includes("pivote") ||
    normalized.includes("interior") || normalized.includes("volante")
  ) return 2;
  if (
    normalized.includes("delantero") || normalized.includes("extremo") || normalized.includes("punta") ||
    normalized.includes("ariete") || normalized.includes("winger")
  ) return 3;
  return 4;
}

function formatPlayerName(player: PlayerResponse): string {
  return `${player.name ?? ""} ${player.lastName ?? ""}`.trim() || player.alias || player.id;
}

export default function NewRatingPage() {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const squadSearch = searchParams.toString() ? `?${searchParams.toString()}&tab=1` : "?tab=1";
  const { role } = usePermissions();
  const canSaveRating = role === "Coach" || role === "Administrator";

  const [playerName, setPlayerName] = useState<string>("");
  const [playerDorsal, setPlayerDorsal] = useState<number | null>(null);
  const [playerPhoto, setPlayerPhoto] = useState<string | null>(null);
  const [isGoalkeeper, setIsGoalkeeper] = useState(false);
  const [playerPosition, setPlayerPosition] = useState<string | null>(null);
  const [teamPlayers, setTeamPlayers] = useState<PlayerResponse[]>([]);
  const [latestTeamRatings, setLatestTeamRatings] = useState<Record<string, PlayerRating>>({});
  const [loadingPlayer, setLoadingPlayer] = useState(true);
  const [answers, setAnswers] = useState<Record<string, CharacteristicAnswer>>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [ratedAt, setRatedAt] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [latestRating, setLatestRating] = useState<PlayerRating | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" | "info" }>({ open: false, message: "", severity: "success" });

  useEffect(() => {
    if (!playerId) return;
    setLoadingPlayer(true);
    Promise.all([getTeamPlayerById(playerId), getRatingHistory(playerId)])
      .then(async ([tp, history]) => {
        if (!tp) return;

        const name = `${tp.player?.name ?? ""} ${tp.player?.lastName ?? ""}`.trim() || tp.id;
        setPlayerName(name);
        setPlayerDorsal(tp.dorsal ?? tp.player?.dorsal ?? null);
        const photoUrl = tp.player?.urlPhoto ?? tp.player?.photoUrl ?? null;
        if (photoUrl) {
          fetchPlayerPhoto(photoUrl).then((obj) => { if (obj) setPlayerPhoto(obj); }).catch(() => {});
        }

        const demarcation = tp.demarcation?.activePositionName ?? tp.player?.position ?? null;
        const goalkeeper = isGoalkeeperDemarcation(demarcation);
        setIsGoalkeeper(goalkeeper);
        setPlayerPosition(demarcation);

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

        if (tp.teamId) {
          try {
            const [squadPlayers, teamRatings] = await Promise.all([
              getPlayersByTeam(tp.teamId),
              getTeamLatestRatings(tp.teamId),
            ]);
            setTeamPlayers(squadPlayers);
            setLatestTeamRatings(
              teamRatings.reduce<Record<string, PlayerRating>>((acc, rating) => {
                acc[rating.teamPlayerId] = rating;
                return acc;
              }, {}),
            );
          } catch {
            setTeamPlayers([]);
            setLatestTeamRatings({});
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

  const peerRatings = useMemo(() => {
    if (!selectedChar) return [];

    const currentPositionCategory = positionCategory(playerPosition);
    return teamPlayers
      .filter((player) => player.id !== playerId)
      .filter((player) => positionCategory(player.position) === currentPositionCategory)
      .map((player) => {
        const rating = latestTeamRatings[player.id];
        return {
          player,
          rating,
          level: rating ? getAnswerLevel(rating, selectedChar.key) : null,
        };
      })
      .filter((item) => item.rating && item.rating.isGoalkeeper === isGoalkeeper)
      .sort((a, b) => {
        const levelA = a.level ?? -1;
        const levelB = b.level ?? -1;
        if (levelA !== levelB) return levelB - levelA;
        return formatPlayerName(a.player).localeCompare(formatPlayerName(b.player), "es");
      });
  }, [isGoalkeeper, latestTeamRatings, playerId, playerPosition, selectedChar, teamPlayers]);

  const peerRatingsByLevel = useMemo(() => {
    const groupedByLevel = new Map<number, typeof peerRatings>();
    for (const item of peerRatings) {
      if (item.level == null) continue;
      const existing = groupedByLevel.get(item.level) ?? [];
      existing.push(item);
      groupedByLevel.set(item.level, existing);
    }
    return groupedByLevel;
  }, [peerRatings]);

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
      || notes.trim() !== (latestRating.notes ?? "").trim()
      || ratedAt !== latestRating.ratedAt.slice(0, 10);
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
        ratedAt: ratedAt ? new Date(ratedAt).toISOString() : null,
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
        title="Nueva valoración"
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
            {canSaveRating && (
              <Button
                size="small"
                variant="contained"
                startIcon={<SaveIcon />}
                disabled={!allAnswered || saving}
                onClick={handleSave}
              >
                {saving ? "Guardando…" : "Guardar"}
              </Button>
            )}
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
                    const peersAtLevel = peerRatingsByLevel.get(level) ?? [];
                    return (
                      <button
                        key={level}
                        className={`${styles.conceptPill} ${isActive ? styles.conceptPillActive : ""}`}
                        onClick={() => selectLevel(level)}
                      >
                        <span className={styles.conceptPillBody}>
                          <span className={styles.conceptLevel}>{level}</span>
                          <span className={styles.conceptText}>{conceptLevel.concept}</span>
                        </span>
                        <span className={styles.conceptPeers}>
                          {peersAtLevel.length > 0 ? (
                            peersAtLevel.map(({ player }) => (
                              <span key={player.id} className={styles.conceptPeerChip}>
                                <span className={styles.conceptPeerName}>{formatPlayerName(player)}</span>
                                <span className={styles.conceptPeerMeta}>
                                  {player.dorsal != null ? `#${player.dorsal}` : ""}
                                </span>
                              </span>
                            ))
                          ) : (
                            <span className={styles.conceptPeerEmpty}>Sin comparativa</span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className={styles.notesArea}>
              <TextField
                label="Fecha de valoración"
                type="date"
                size="small"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={ratedAt}
                onChange={(e) => setRatedAt(e.target.value)}
                sx={{ mb: 1.5 }}
              />
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
