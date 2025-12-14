import React from "react";
import {
  Modal,
  Box,
  CircularProgress,
  Typography,
  IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AgeSummaryBox from "../../../components/players/AgeSummaryBox/AgeSummaryBox";
import styles from "./AgeModal.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  ageSummary: Record<number, number>;
  title?: string;
};

export default function AgeModal({
  open,
  onClose,
  loading,
  ageSummary,
  title = "Resumen de edades",
}: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      aria-labelledby="age-summary-title"
      closeAfterTransition
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: "rgba(2, 6, 23, 0.45)",
          },
        },
      }}
    >
      <Box className={styles.modalContent}>
        <IconButton
          aria-label="Cerrar"
          onClick={onClose}
          size="small"
          className={styles.closeButton}
        >
          <CloseIcon />
        </IconButton>

        {loading ? (
          <div className={styles.loadingContainer}>
            <CircularProgress size={28} color="inherit" />
          </div>
        ) : (
          <AgeSummaryBox playersCountByAge={ageSummary} title={title} />
        )}
      </Box>
    </Modal>
  );
}
