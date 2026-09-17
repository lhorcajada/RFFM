import { useState } from "react";
import { Button, CircularProgress } from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { downloadTeamDocumentsReport, mapPlayerDocumentError } from "../../../services/playerDocumentService";

type Props = {
  teamId: string;
  documentTypeId: string;
};

export default function DocumentReportButton({ teamId, documentTypeId }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const blob = await downloadTeamDocumentsReport(teamId, documentTypeId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `Documentos_${documentTypeId}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      const code = err?.response?.data?.code;
      const error = mapPlayerDocumentError(code);
      window.dispatchEvent(
        new CustomEvent("rffm.show_snackbar", {
          detail: { message: error.message, severity: error.severity },
        })
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="contained"
      size="small"
      startIcon={loading ? <CircularProgress size={16} /> : <PictureAsPdfIcon />}
      onClick={handleDownload}
      disabled={loading}
    >
      Descargar informe
    </Button>
  );
}
