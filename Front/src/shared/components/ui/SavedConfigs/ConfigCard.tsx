import React from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActions from "@mui/material/CardActions";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import DeleteIcon from "@mui/icons-material/Delete";
import styles from "./ConfigCard.module.css";

type ConfigCardProps = {
  id: string;
  teamName?: string;
  competitionName?: string;
  groupName?: string;
  isPrimary?: boolean;
  onSetPrimary: (id: string) => void;
  onDelete: (id: string) => void;
};

export default function ConfigCard({
  id,
  teamName,
  competitionName,
  groupName,
  isPrimary,
  onSetPrimary,
  onDelete,
}: ConfigCardProps) {
  return (
    <Card className={styles.card}>
      <CardContent className={styles.content}>
        <Typography variant="subtitle2" className={styles.teamName}>
          {teamName ?? "-"}
        </Typography>
        <Stack direction="row" spacing={0.5} className={styles.chips}>
          <Chip
            size="small"
            label={competitionName ?? "-"}
            variant="outlined"
          />
          <Chip size="small" label={groupName ?? "-"} variant="outlined" />
        </Stack>
      </CardContent>
      <CardActions className={styles.actions}>
        <IconButton
          aria-label="primary"
          onClick={() => onSetPrimary(id)}
          color={isPrimary ? "primary" : "default"}
          size="small"
        >
          {isPrimary ? <StarIcon /> : <StarBorderIcon />}
        </IconButton>
        <IconButton
          aria-label="delete"
          onClick={() => onDelete(id)}
          size="small"
          color="error"
        >
          <DeleteIcon />
        </IconButton>
      </CardActions>
    </Card>
  );
}
