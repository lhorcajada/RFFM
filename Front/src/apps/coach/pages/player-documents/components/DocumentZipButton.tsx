import { useState } from "react";
import { Button, CircularProgress, IconButton, Tooltip } from "@mui/material";
import FolderZipIcon from "@mui/icons-material/FolderZip";
import { downloadTeamDocumentsZip, mapPlayerDocumentError } from "../../../services/playerDocumentService";

type Props = {
  teamId: string;
  documentTypeId: string;
  iconOnly?: boolean;
};

export default function DocumentZipButton({ teamId, documentTypeId, iconOnly }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const blob = await downloadTeamDocumentsZip(teamId, documentTypeId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `Documentos_${documentTypeId}.zip`;
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

  if (iconOnly) {
    return (
      <Tooltip title="Descargar ZIP">
        <span>
          <IconButton
            color="primary"
            onClick={handleDownload}
            disabled={loading}
            aria-label="Descargar ZIP"
          >
            {loading ? <CircularProgress size={20} /> : <FolderZipIcon />}
          </IconButton>
        </span>
      </Tooltip>
    );
  }

  return (
    <Button
      variant="outlined"
      size="small"
      startIcon={loading ? <CircularProgress size={16} /> : <FolderZipIcon />}
      onClick={handleDownload}
      disabled={loading}
    >
      Descargar ZIP
    </Button>
  );
}
