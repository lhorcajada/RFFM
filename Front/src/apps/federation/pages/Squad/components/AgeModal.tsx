import React from "react";
import { Modal, Box, CircularProgress, Typography } from "@mui/material";
import AgeSummaryBox from "../../../components/players/AgeSummaryBox/AgeSummaryBox";

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
    >
      <Box
        style={{
          padding: 18,
          maxWidth: 520,
          margin: "40px auto",
          outline: "none",
        }}
      >
        {loading ? (
          <div
            style={{ display: "flex", justifyContent: "center", padding: 18 }}
          >
            <CircularProgress size={28} color="inherit" />
          </div>
        ) : (
          <AgeSummaryBox playersCountByAge={ageSummary} title={title} />
        )}
      </Box>
    </Modal>
  );
}
