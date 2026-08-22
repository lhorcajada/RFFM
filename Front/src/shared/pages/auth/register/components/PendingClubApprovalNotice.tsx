import { Alert, Typography } from "@mui/material";
import styles from "./PendingClubApprovalNotice.module.css";

interface Props {
  kind?: "club" | "playerLink";
}

const MESSAGES: Record<"club" | "playerLink", string> = {
  club: "Tu solicitud de club ha sido enviada. Un director del club deberá aprobarla antes de que puedas acceder. Te avisaremos por correo cuando se resuelva.",
  playerLink: "Tu solicitud de vinculación ha sido enviada. El entrenador del equipo deberá aprobarla antes de que puedas acceder a los datos del jugador. Te avisaremos por correo cuando se resuelva.",
};

export default function PendingClubApprovalNotice({ kind = "club" }: Props) {
  return (
    <Alert severity="info" className={styles.notice}>
      <Typography variant="body1">{MESSAGES[kind]}</Typography>
    </Alert>
  );
}
