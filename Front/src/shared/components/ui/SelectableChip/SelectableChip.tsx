import React from "react";
import { Chip } from "@mui/material";

import styles from "./SelectableChip.module.css";

interface SelectableChipProps {
  label: string;
  selected?: boolean;
  onSelect: () => void;
}

export default function SelectableChip({ label, selected = false, onSelect }: SelectableChipProps) {
  return (
    <Chip
      label={label}
      size="small"
      clickable
      onClick={onSelect}
      className={`${styles.chip}${selected ? ` ${styles.selected}` : ""}`}
    />
  );
}