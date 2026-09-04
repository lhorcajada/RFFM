import { useEffect, useState } from "react";
import {
  Avatar,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import type { PlayerResponse } from "../../../services/teamplayerService";
import type { ExcuseType } from "../../../services/excuseTypeService";
import type { ClubKit } from "../../../services/kitService";
import { getTeamKits } from "../../../services/kitService";
import type { TeamNote } from "../../../services/teamNoteService";
import { getTeamNotes } from "../../../services/teamNoteService";
import type { MatchState } from "./convocationMatchDetail.types";
import {
  buildConvocationSummary,
  buildMapsSearchUrl,
  buildWhatsAppText,
  getExcuseLabel,
  playerDisplayName,
} from "../utils/convocationSummary";
import { colorName } from "../utils/kitColors";
import Jersey from "../../../../federation/components/players/Jersey/Jersey";
import styles from "./ConvocationDetailsDialog.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  match: MatchState | null;
  calledIds: string[];
  notCalledIds: string[];
  players: PlayerResponse[];
  photos: Record<string, string | null>;
  excuseMap: Record<string, number | null>;
  excuseTypes: ExcuseType[];
  kits: ClubKit[];
  selectedKitNumber: number | null;
  teamId: string;
  /** Only Coaches can copy the convocation text to WhatsApp from this dialog */
  canCopyToWhatsApp: boolean;
};

export default function ConvocationDetailsDialog({
  open,
  onClose,
  match,
  calledIds,
  notCalledIds,
  players,
  photos,
  excuseMap,
  excuseTypes,
  kits,
  selectedKitNumber,
  teamId,
  canCopyToWhatsApp,
}: Props) {
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notes, setNotes] = useState<TeamNote[]>([]);
  // Re-fetched fresh every time the dialog opens, instead of trusting the `kits` prop,
  // which the host page only loads once at mount — without this, a kit edited from a
  // different page (e.g. ConvocationMatchDetail) would still show stale colors here.
  const [liveKits, setLiveKits] = useState<ClubKit[]>(kits);

  useEffect(() => {
    if (!open || !teamId) return;
    let mounted = true;
    getTeamNotes(teamId)
      .then((data) => {
        if (mounted) setNotes(data);
      })
      .catch(() => {});
    getTeamKits(teamId)
      .then((data) => {
        if (mounted) setLiveKits(data);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [open, teamId]);

  if (!open) return null;

  const summary = buildConvocationSummary({
    match,
    calledIds,
    notCalledIds,
    players,
    excuseMap,
    kits: liveKits,
    selectedKitNumber,
  });

  const handleCopy = async () => {
    if (copying) return;
    setCopying(true);
    try {
      const text = buildWhatsAppText(match, summary, excuseMap, excuseTypes, notes);
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } finally {
      setCopying(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle className={styles.header}>
        <span className={styles.matchTitle}>
          {match?.localTeamName ?? "—"} vs {match?.visitorTeamName ?? "—"}
        </span>
        <IconButton
          aria-label="Cerrar"
          onClick={onClose}
          sx={{ position: "absolute", right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {(summary.dateES || match?.time || summary.arrival || match?.field) && (
          <div className={styles.section}>
            {summary.dateES && (
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Fecha:</span>
                <span>{summary.dateES}</span>
              </div>
            )}
            {match?.time && (
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Hora del partido:</span>
                <span>{match.time}</span>
              </div>
            )}
            {summary.arrival && (
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Hora de llegada:</span>
                <span>{summary.arrival}</span>
              </div>
            )}
            {match?.field && (
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Campo:</span>
                <span>
                  {match.field}
                  {" · "}
                  <a
                    className={styles.locationLink}
                    href={match.locationMapUrl || buildMapsSearchUrl(match.field)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Ver en el mapa
                  </a>
                </span>
              </div>
            )}
          </div>
        )}

        {liveKits.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Equipación</div>
            <div className={styles.kitsRow}>
              {liveKits.map((kit) => {
                const isSelected = kit.kitNumber === selectedKitNumber;
                return (
                  <div
                    key={kit.kitNumber}
                    className={`${styles.kitCard} ${isSelected ? styles.kitCardSelected : ""}`}
                  >
                    <Jersey primary={kit.shirtColor} size={36} />
                    <span className={styles.kitCardLabel}>
                      {kit.kitNumber === 1 ? "1ª Equipación" : "2ª Equipación"}
                    </span>
                    <span className={styles.kitCardColors}>
                      Camiseta {colorName(kit.shirtColor)} / Pantalón {colorName(kit.shortsColor)}
                    </span>
                    <span
                      className={
                        isSelected ? styles.kitCardTagSelected : styles.kitCardTagOther
                      }
                    >
                      {isSelected ? "Se juega con esta" : "Traer también"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {summary.selectedKit && (
          <div className={styles.kitNote}>
            <div>
              Se juega con: {summary.selectedKit.kitNumber === 1 ? "1ª Equipación" : "2ª Equipación"}
            </div>
          </div>
        )}

        {notes.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Notas</div>
            <ul className={styles.notesList} aria-label="Notas">
              {notes.map((note) => (
                <li key={note.id}>{note.text}</li>
              ))}
            </ul>
          </div>
        )}

        <div className={styles.section}>
          <div className={`${styles.sectionTitle} ${styles.calledSectionTitle}`}>
            Convocados ({summary.totalCalled})
          </div>
          {summary.calledPlayers.length === 0 ? (
            <p className={styles.emptyText}>Sin jugadores convocados</p>
          ) : (
            summary.calledPlayers.map((p) => (
              <div key={p.id} className={styles.playerCard}>
                <Avatar src={photos[p.id] ?? undefined} sx={{ width: 32, height: 32 }}>
                  {playerDisplayName(p).charAt(0)}
                </Avatar>
                <span className={styles.playerName}>{playerDisplayName(p)}</span>
                {p.dorsal != null && (
                  <span className={styles.playerDorsal}>Nº {p.dorsal}</span>
                )}
              </div>
            ))
          )}
        </div>

        {summary.notCalledPlayers.length > 0 && (
          <div className={styles.section}>
            <div className={`${styles.sectionTitle} ${styles.notCalledSectionTitle}`}>
              Desconvocados ({summary.uniqueNotCalledIds.length})
            </div>
            {summary.notCalledPlayers.map((p) => (
              <div key={p.id} className={`${styles.playerCard} ${styles.playerCardNotCalled}`}>
                <Avatar src={photos[p.id] ?? undefined} sx={{ width: 32, height: 32 }}>
                  {playerDisplayName(p).charAt(0)}
                </Avatar>
                <span className={styles.playerName}>{playerDisplayName(p)}</span>
                <span className={styles.playerExcuse}>
                  {getExcuseLabel(excuseMap[p.id], excuseTypes)}
                </span>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
        {canCopyToWhatsApp && (
          <Button
            variant="outlined"
            startIcon={
              copying ? (
                <CircularProgress size={14} color="inherit" />
              ) : copied ? (
                <CheckIcon />
              ) : (
                <WhatsAppIcon />
              )
            }
            disabled={copying}
            onClick={handleCopy}
            sx={{
              borderColor: copied ? "#4caf50" : "#25D366",
              color: copied ? "#4caf50" : "#25D366",
              "&:hover": {
                borderColor: copied ? "#4caf50" : "#25D366",
                backgroundColor: "rgba(37,211,102,0.08)",
              },
            }}
          >
            {copied ? (
              <>
                <ContentCopyIcon sx={{ fontSize: 14, mr: 0.5 }} />
                ¡Copiado!
              </>
            ) : (
              "Copiar para WhatsApp"
            )}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
