import { Button, CircularProgress } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";

type Props = {
  teamId: string;
  tab: number;
  eventId: string | null;
  lineupPlayersCount: number;
  printing: boolean;
  whatsappCopying: boolean;
  whatsappCopied: boolean;
  onBack: () => void;
  onOpenEvent: () => void;
  onSaveConvocation: () => void;
  onSaveLineup: () => void;
  onPrint: () => void;
  onWhatsAppCopy: () => void;
};

export default function ConvocationMatchActionBar({
  teamId,
  tab,
  eventId,
  lineupPlayersCount,
  printing,
  whatsappCopying,
  whatsappCopied,
  onBack,
  onOpenEvent,
  onSaveConvocation,
  onSaveLineup,
  onPrint,
  onWhatsAppCopy,
}: Props) {
  return (
    <>
      <Button startIcon={<ArrowBackIcon />} onClick={onBack} variant="outlined" size="small">
        Volver
      </Button>
      {eventId && (
        <Button startIcon={<PeopleAltIcon />} variant="outlined" size="small" onClick={onOpenEvent}>
          Ir al evento
        </Button>
      )}
      {tab === 2 && eventId && (
        <Button variant="contained" size="small" onClick={onSaveConvocation}>
          Guardar
        </Button>
      )}
      {tab === 1 && eventId && lineupPlayersCount > 0 && (
        <Button variant="contained" size="small" onClick={onSaveLineup}>
          Guardar
        </Button>
      )}
      {eventId && (
        <Button
          variant="outlined"
          size="small"
          startIcon={printing ? <CircularProgress size={14} color="inherit" /> : <PictureAsPdfIcon />}
          disabled={printing}
          onClick={onPrint}
        >
          PDF
        </Button>
      )}
      {eventId && (
        <Button
          variant="outlined"
          size="small"
          startIcon={
            whatsappCopying ? (
              <CircularProgress size={14} color="inherit" />
            ) : whatsappCopied ? (
              <CheckIcon />
            ) : (
              <WhatsAppIcon />
            )
          }
          disabled={whatsappCopying}
          onClick={onWhatsAppCopy}
          sx={{
            borderColor: whatsappCopied ? "#4caf50" : "#25D366",
            color: whatsappCopied ? "#4caf50" : "#25D366",
            "&:hover": {
              borderColor: whatsappCopied ? "#4caf50" : "#25D366",
              backgroundColor: "rgba(37,211,102,0.08)",
            },
          }}
        >
          {whatsappCopied ? (
            <>
              <ContentCopyIcon sx={{ fontSize: 14, mr: 0.5 }} />
              ¡Copiado!
            </>
          ) : (
            "WhatsApp"
          )}
        </Button>
      )}
    </>
  );
}