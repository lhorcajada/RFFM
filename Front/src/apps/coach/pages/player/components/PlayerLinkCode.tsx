import React, { useEffect, useState } from "react";
import {
  Box,
  CircularProgress,
  IconButton,
  Tooltip,
  Typography,
  Alert,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  getTeamPlayerLinkCode,
  regenerateTeamPlayerLinkCode,
} from "../../../services/teamplayerService";
import ConfirmDialog from "../../../../../shared/components/ui/ConfirmDialog/ConfirmDialog";
import styles from "../PlayerDetail.module.css";

type Props = {
  teamPlayerId: string;
};

export default function PlayerLinkCode({ teamPlayerId }: Props) {
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await getTeamPlayerLinkCode(teamPlayerId);
      setLinkCode(result.linkCode);
    } catch (err) {
      setError("Error al cargar el código de vinculación");
      setLinkCode(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [teamPlayerId]);

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const result = await regenerateTeamPlayerLinkCode(teamPlayerId);
      setLinkCode(result.linkCode);
      setConfirmOpen(false);
    } catch (err) {
      setError("Error al regenerar el código");
    } finally {
      setRegenerating(false);
    }
  }

  async function handleCopy() {
    if (!linkCode) return;
    try {
      await navigator.clipboard.writeText(linkCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Error al copiar el código");
    }
  }

  if (loading) {
    return (
      <div className={styles.card}>
        <div className={styles.sectionInner}>
          <h3>Código de vinculación</h3>
          <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
            <CircularProgress />
          </Box>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.card}>
        <div className={styles.sectionInner}>
          <h3>Código de vinculación</h3>
          <Alert severity="error">{error}</Alert>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.sectionInner}>
        <h3>Código de vinculación</h3>
        {linkCode ? (
          <>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                mb: 2,
                p: 1.5,
                bgcolor: "action.hover",
                borderRadius: 1,
              }}
            >
              <Typography
                variant="body1"
                sx={{
                  fontFamily: "monospace",
                  fontWeight: 600,
                  fontSize: "1.1rem",
                  flex: 1,
                }}
              >
                {linkCode}
              </Typography>
              <Tooltip title={copied ? "Copiado" : "Copiar código"}>
                <IconButton
                  size="small"
                  aria-label="Copiar código"
                  onClick={handleCopy}
                  sx={{
                    color: copied ? "success.main" : "primary.main",
                  }}
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <Typography variant="caption" color="textSecondary" display="block" sx={{ mb: 2 }}>
              Comparte este código con jugadores o familiares para que se vinculen rápidamente.
            </Typography>
            <Tooltip title="Regenerar código">
              <span>
                <IconButton
                  size="small"
                  aria-label="Regenerar código"
                  onClick={() => setConfirmOpen(true)}
                  disabled={regenerating}
                  color="primary"
                >
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </>
        ) : (
          <Typography variant="body2" color="textSecondary">
            Sin código asignado
          </Typography>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="¿Regenerar código?"
        description="¿Regenerar el código de vinculación? El código anterior dejará de funcionar."
        confirmText="Regenerar"
        processing={regenerating}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleRegenerate}
      />
    </div>
  );
}
