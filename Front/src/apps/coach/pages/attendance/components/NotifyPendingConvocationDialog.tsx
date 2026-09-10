import React, { useEffect, useState } from "react";
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import CheckIcon from "@mui/icons-material/Check";
import convocationNotificationService, {
  type PlayerRecipients,
} from "../../../services/convocationNotificationService";
import {
  buildPendingConfirmationMessage,
  buildWaMeLink,
  type PendingConfirmationEventSummary,
} from "../utils/pendingConfirmationWhatsApp";
import styles from "../AttendanceTabs.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  eventId: string;
  teamPlayerIds: string[];
  eventSummary?: PendingConfirmationEventSummary;
};

export default function NotifyPendingConvocationDialog({
  open,
  onClose,
  eventId,
  teamPlayerIds,
  eventSummary,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerRecipients[]>([]);
  const [openedIds, setOpenedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setLoading(true);
    setError(null);
    setOpenedIds(new Set());
    convocationNotificationService
      .getConvocationNotificationRecipients(eventId, teamPlayerIds)
      .then((data) => {
        if (!mounted) return;
        setPlayers(data);
      })
      .catch(() => {
        if (!mounted) return;
        setError("Error al cargar los destinatarios");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, eventId, teamPlayerIds.join(",")]);

  const playersWithoutRecipients = players.filter((p) => p.familyMembers.length === 0);
  const selectedCount = teamPlayerIds.length;
  const playersWithRecipientsCount = selectedCount - playersWithoutRecipients.length;

  const handleOpenLink = (player: PlayerRecipients, familyMemberId: string, phone: string) => {
    if (!eventSummary) return;
    const deepLinkUrl = `${window.location.origin}/coach/attendance/${eventId}?viewConvocation=1`;
    const message = buildPendingConfirmationMessage(eventSummary, player.playerAlias, deepLinkUrl);
    const link = buildWaMeLink(phone, message);
    window.open(link, "_blank", "noopener,noreferrer");
    setOpenedIds((prev) => new Set(prev).add(familyMemberId));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Notificar por WhatsApp</DialogTitle>
      <DialogContent>
        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
            <CircularProgress />
          </div>
        )}
        {!loading && error && <div style={{ color: "#d32f2f" }}>{error}</div>}
        {!loading && !error && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {playersWithoutRecipients.length > 0 && (
              <div style={{ fontWeight: 600 }}>
                {playersWithRecipientsCount} de {selectedCount} jugadores seleccionados tienen un
                familiar al que notificar
              </div>
            )}
            {teamPlayerIds.map((teamPlayerId) => {
              const player = players.find((p) => p.teamPlayerId === teamPlayerId);
              const playerAlias = player?.playerAlias ?? teamPlayerId;
              const familyMembers = player?.familyMembers ?? [];
              return (
                <div key={teamPlayerId} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontWeight: 600 }}>{playerAlias}</div>
                  {familyMembers.length === 0 ? (
                    <div style={{ opacity: 0.7, fontSize: "0.85rem" }}>
                      Sin familiar con cuenta registrada y teléfono
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {familyMembers.map((fm) => {
                        const opened = openedIds.has(fm.familyMemberId);
                        const label = `${fm.familyMember ?? "Familiar"}: ${(fm.name ?? "") + " " + (fm.lastName ?? "")}`.trim();
                        return (
                          <Button
                            key={fm.familyMemberId}
                            variant="outlined"
                            startIcon={opened ? <CheckIcon /> : <WhatsAppIcon />}
                            onClick={() =>
                              player && handleOpenLink(player, fm.familyMemberId, fm.phone)
                            }
                            sx={{
                              justifyContent: "flex-start",
                              borderColor: opened ? "#4caf50" : "#25D366",
                              color: opened ? "#4caf50" : "#25D366",
                              "&:hover": {
                                borderColor: opened ? "#4caf50" : "#25D366",
                                backgroundColor: "rgba(37,211,102,0.08)",
                              },
                            }}
                          >
                            {opened ? "Abierto" : label}
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
