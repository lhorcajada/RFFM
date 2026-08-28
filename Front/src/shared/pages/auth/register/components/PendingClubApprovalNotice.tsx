import { Alert, Typography } from "@mui/material";
import styles from "./PendingClubApprovalNotice.module.css";

const MESSAGE =
  "Tu solicitud de club ha sido enviada. Un director del club deberá aprobarla antes de que puedas acceder. Te avisaremos por correo cuando se resuelva.";

export default function PendingClubApprovalNotice() {
  return (
    <Alert severity="info" className={styles.notice}>
      <Typography variant="body1">{MESSAGE}</Typography>
    </Alert>
  );
}
