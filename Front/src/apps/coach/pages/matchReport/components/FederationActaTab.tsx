import { useEffect, useState } from "react";
import { Alert, CircularProgress } from "@mui/material";
import ActaContent from "../../../../../shared/components/acta/ActaContent/ActaContent";
import type { Acta } from "../../../../../shared/types/acta";
import { getEventFederationActa } from "../../../services/matchReportService";
import styles from "./FederationActaTab.module.css";

type Props = {
  eventId: string;
};

export default function FederationActaTab({ eventId }: Props) {
  const [acta, setActa] = useState<Acta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(false);
    getEventFederationActa(eventId)
      .then((data) => {
        if (mounted) setActa(data);
      })
      .catch(() => {
        if (mounted) setError(true);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [eventId]);

  if (loading) {
    return (
      <div className={styles.center}>
        <CircularProgress />
      </div>
    );
  }
  if (error || !acta) {
    return <Alert severity="warning">No se ha podido cargar el acta de federación.</Alert>;
  }
  return <ActaContent acta={acta} />;
}
