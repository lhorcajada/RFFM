import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import type { PoolPlayer, RecruitmentStatus } from "../../SeasonPrep";

interface RecruitmentSummaryDialogProps {
  open: boolean;
  onClose: () => void;
  players: PoolPlayer[];
}

const STATUS_CONFIG: { value: RecruitmentStatus; label: string; color: string; bg: string }[] = [
  { value: "fichado",    label: "Fichados",    color: "#22c55e", bg: "rgba(34,197,94,0.08)" },
  { value: "interesado", label: "Interesados", color: "#4d9de0", bg: "rgba(77,157,224,0.08)" },
  { value: "observando", label: "Observando",  color: "#9e9e9e", bg: "rgba(158,158,158,0.08)" },
  { value: "descartado", label: "Descartados", color: "#ef4444", bg: "rgba(239,68,68,0.08)" },
];

export function RecruitmentSummaryDialog({ open, onClose, players }: RecruitmentSummaryDialogProps) {
  const byStatus = (status: RecruitmentStatus) =>
    players.filter((p) => (p.recruitmentStatus ?? "observando") === status);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" scroll="paper">
      <DialogTitle sx={{ display: "flex", alignItems: "center", pr: 1 }}>
        Resumen por estado
        <IconButton sx={{ ml: "auto" }} size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        {STATUS_CONFIG.map(({ value, label, color, bg }, idx) => {
          const group = byStatus(value);
          return (
            <Box key={value}>
              {idx > 0 && <Divider />}
              <Box sx={{ px: 2, py: 1.5, bgcolor: bg }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: group.length ? 1 : 0 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{ color, fontWeight: 700, fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.05em" }}
                  >
                    {label}
                  </Typography>
                  <Chip
                    size="small"
                    label={group.length}
                    sx={{ height: 18, fontSize: "0.7rem", bgcolor: color, color: "#fff" }}
                  />
                </Box>
                {group.length === 0 ? (
                  <Typography variant="body2" sx={{ opacity: 0.4, fontSize: "0.78rem" }}>
                    Ninguno
                  </Typography>
                ) : (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                    {group.map((p) => (
                      <Chip
                        key={p.uniqueId}
                        label={
                          <Box component="span" sx={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
                            <span style={{ fontWeight: 600, fontSize: "0.78rem" }}>{p.name}</span>
                            {(p.team || p.procedencia) && (
                              <span style={{ fontSize: "0.65rem", opacity: 0.7 }}>
                                {p.team || p.procedencia}
                              </span>
                            )}
                          </Box>
                        }
                        variant="outlined"
                        sx={{
                          height: "auto",
                          py: "3px",
                          borderColor: color,
                          "& .MuiChip-label": { px: 1 },
                        }}
                      />
                    ))}
                  </Box>
                )}
              </Box>
            </Box>
          );
        })}
      </DialogContent>
    </Dialog>
  );
}
