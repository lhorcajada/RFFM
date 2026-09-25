import { Button, CircularProgress } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import VisibilityIcon from "@mui/icons-material/Visibility";
import MinutesReasonEditor from "./MinutesReasonEditor";
import type { PlayerMinutesReason } from "./MinutesReasonsListDialog";

type Props = {
  teamId: string;
  tab: number;
  eventId: string | null;
  lineupPlayersCount: number;
  printing: boolean;
  /** true once every called-up player has confirmed their convocation (no one left pending) */
  convocationConfirmed: boolean;
  onBack: () => void;
  onOpenEvent: () => void;
  onSaveConvocation: () => void;
  onSaveLineup: () => void;
  onPrint: () => void;
  onViewConvocation: () => void;
  /** Opens the full-screen live match page. When omitted the button is not shown. */
  onOpenLiveMatch?: () => void;
  /** Pre-match minutes reasons for the "Alineación" tab (tab === 1). Optional — when omitted
   *  (or when onSaveMinutesReason is not provided) the button is not shown. Purely additive,
   *  never required to save the lineup. */
  minutesReasonsPlayers?: PlayerMinutesReason[];
  onSaveMinutesReason?: (playerId: string, reason: string | null) => Promise<void>;
};

export default function ConvocationMatchActionBar({
  teamId,
  tab,
  eventId,
  lineupPlayersCount,
  printing,
  convocationConfirmed,
  onBack,
  onOpenEvent,
  onSaveConvocation,
  onSaveLineup,
  onPrint,
  onViewConvocation,
  onOpenLiveMatch,
  minutesReasonsPlayers,
  onSaveMinutesReason,
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
      {tab === 1 && onSaveMinutesReason && minutesReasonsPlayers && minutesReasonsPlayers.length > 0 && (
        <MinutesReasonEditor players={minutesReasonsPlayers} onSave={onSaveMinutesReason} />
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