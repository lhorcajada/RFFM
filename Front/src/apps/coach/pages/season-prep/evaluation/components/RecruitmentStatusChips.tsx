import { Box, Chip } from "@mui/material";

import type { RecruitmentStatus } from "../../SeasonPrep";

export const RECRUITMENT_STATUS_OPTIONS: { value: RecruitmentStatus; label: string; color: string }[] = [
  { value: "observando", label: "Observando", color: "#9e9e9e" },
  { value: "interesado", label: "Interesado", color: "#4d9de0" },
  { value: "fichado", label: "Fichado", color: "#22c55e" },
  { value: "descartado", label: "Descartado", color: "#ef4444" },
];

function statusColor(status: RecruitmentStatus | undefined): string {
  return RECRUITMENT_STATUS_OPTIONS.find((option) => option.value === status)?.color ?? "#9e9e9e";
}

interface RecruitmentStatusChipsProps {
  value: RecruitmentStatus;
  onChange: (status: RecruitmentStatus) => void;
}

export function RecruitmentStatusChips({ value, onChange }: RecruitmentStatusChipsProps) {
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
      {RECRUITMENT_STATUS_OPTIONS.map((option) => {
        const active = option.value === value;
        const color = statusColor(option.value);

        return (
          <Chip
            key={option.value}
            label={option.label}
            size="small"
            clickable
            onClick={(event) => {
              event.stopPropagation();
              onChange(option.value);
            }}
            onMouseDown={(event) => event.stopPropagation()}
            variant={active ? "filled" : "outlined"}
            sx={{
              fontSize: "0.72rem",
              height: 24,
              fontWeight: 700,
              borderColor: color,
              color: active ? "#ffffff" : color,
              bgcolor: active ? color : "transparent",
              "& .MuiChip-label": { px: 1 },
              "&:hover": {
                bgcolor: active ? color : "rgba(255,255,255,0.06)",
              },
            }}
          />
        );
      })}
    </Box>
  );
}