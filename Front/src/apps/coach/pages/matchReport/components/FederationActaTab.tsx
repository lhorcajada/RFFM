import { useEffect, useRef, useState } from "react";
import { Alert, Button, CircularProgress } from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import ActaContent from "../../../../../shared/components/acta/ActaContent/ActaContent";
import type { Acta } from "../../../../../shared/types/acta";
import { exportElementToPdf } from "../../../../../shared/services/pdfService";
import { getEventFederationActa } from "../../../services/matchReportService";
import styles from "./FederationActaTab.module.css";

type Props = {
  eventId: string;
  onPlayerClick?: (playerCode: string, playerName?: string) => void;
};

export default function FederationActaTab({ eventId, onPlayerClick }: Props) {
  const [acta, setActa] = useState<Acta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [exporting, setExporting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

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
  const handleDownloadPdf = async () => {
    if (!printRef.current) return;
    setExporting(true);
    try {
      await exportElementToPdf(printRef.current, `Acta ${acta.equipo_local ?? ""} - ${acta.equipo_visitante ?? ""}.pdf`);
    } catch {
      window.dispatchEvent(
        new CustomEvent("rffm.show_snackbar", {
          detail: { message: "No se ha podido generar el PDF del acta.", severity: "error" },
        }),
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className={styles.toolbar}>
        <Button variant="outlined" size="small" startIcon={<PictureAsPdfIcon />} onClick={handleDownloadPdf} disabled={exporting}>
          Descargar PDF
        </Button>
      </div>
      <div ref={printRef}>
        <ActaContent acta={acta} onPlayerClick={onPlayerClick} />
      </div>
    </div>
  );
}
