import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, CircularProgress } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import { getSportEventById } from "../../services/sportEventService";
import PartidoEnDirectoTab from "./components/PartidoEnDirectoTab";
import type { MatchState } from "./components/convocationMatchDetail.types";
import { toMatchState } from "./helpers/convocationUtils";
import { useLiveMatchLineupPlayers } from "./hooks/useLiveMatchLineupPlayers";
import styles from "./LiveMatchPage.module.css";

/** Pantalla completa del partido en directo: sin cabecera ni pie de la app,
 *  solo una barra mínima con "Volver" para aprovechar todo el alto de la tablet. */
export default function LiveMatchPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const teamId = params.get("teamId") ?? "";
  const eventId = params.get("eventId");
  const stateMatch = (location.state as { match?: MatchState } | null)?.match ?? null;

  const [match, setMatch] = useState<MatchState | null>(stateMatch);
  const [isFriendly, setIsFriendly] = useState(false);
  const [loading, setLoading] = useState(!!eventId);

  useEffect(() => {
    if (!eventId) return;
    let mounted = true;
    setLoading(true);
    getSportEventById(eventId)
      .then((event) => {
        if (!mounted) return;
        setMatch(event ? toMatchState(event) : null);
        setIsFriendly(event?.matchCategory === "Friendly");
      })
      .catch(() => {
        if (mounted) setMatch(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [eventId]);

  const { lineupPlayers } = useLiveMatchLineupPlayers(teamId, match?.date);

  const handleBack = () => {
    const qs = new URLSearchParams();
    if (teamId) qs.set("teamId", teamId);
    if (eventId) qs.set("eventId", eventId);
    navigate(`/coach/convocations/match?${qs.toString()}`, { state: { match } });
  };

  return (
    <div className={styles.page}>
      <div className={styles.bar}>
        <Button startIcon={<ArrowBackIcon />} onClick={handleBack} variant="outlined" size="small">
          Volver
        </Button>
      </div>
      <div className={styles.content}>
        {loading ? (
          <div className={styles.center}>
            <CircularProgress />
          </div>
        ) : !match || !eventId ? (
          <div className={styles.center}>
            <EmptyState description="No se encontró el partido. Vuelve a la ficha del partido e inténtalo de nuevo." />
          </div>
        ) : (
          <PartidoEnDirectoTab
            teamId={teamId}
            eventId={eventId}
            lineupPlayers={lineupPlayers}
            localTeamName={match.localTeamName || "Local"}
            localTeamShield={match.localTeamShield ?? null}
            visitorTeamName={match.visitorTeamName || "Visitante"}
            visitorTeamShield={match.visitorTeamShield ?? null}
            isHomeTeam={match.isHomeTeam ?? true}
            isFriendly={isFriendly}
          />
        )}
      </div>
    </div>
  );
}
