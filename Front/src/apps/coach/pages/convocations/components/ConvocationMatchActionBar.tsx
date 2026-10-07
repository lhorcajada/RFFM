import { Button, CircularProgress } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { CONVOCATION_TAB } from "./convocationMatchDetail.types";

type Props = {
  teamId: string;
  tab: number;
  eventId: string | null;
  printing: boolean;
  /** true once every called-up player has confirmed their convocation (no one left pending) */
  convocationConfirmed: boolean;
  onBack: () => void;
  onOpenEvent: () => void;
  onSaveConvocation: () => void;
  onPrint: () => void;
  onViewConvocation: () => void;
  /** Opens the full-screen live match page. When omitted the button is not shown. */
  onOpenLiveMatch?: () => void;
};

export default function ConvocationMatchActionBar({
  teamId,
  tab,
  eventId,
  printing,
  convocationConfirmed,
  onBack,
  onOpenEvent,
  onSaveConvocation,
  onPrint,
  onViewConvocation,
  onOpenLiveMatch,
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
      {eventId && onOpenLiveMatch && (
        <Button
          startIcon={<SportsSoccerIcon />}
          variant="contained"
          color="secondary"
          size="small"
          onClick={onOpenLiveMatch}
        >
          Partido en directo
        </Button>
      )}
      {tab === CONVOCATION_TAB.Convocatoria && eventId && (
        <Button variant="contained" size="small" onClick={onSaveConvocation}>
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
      {eventId && convocationConfirmed && (
        <Button
          startIcon={<VisibilityIcon />}
          variant="outlined"
          size="small"
          onClick={onViewConvocation}
        >
          Ver convocatoria
        </Button>
      )}
    </>
  );
}