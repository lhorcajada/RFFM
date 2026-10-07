import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getSportEventById } from "../../../services/sportEventService";
import type { MatchState } from "../components/convocationMatchDetail.types";
import { toMatchState } from "../helpers/convocationUtils";

export type MatchFromUrl = {
  teamId: string;
  eventId: string | null;
  match: MatchState | null;
  isFriendly: boolean;
  loading: boolean;
  /** Vuelve a la ficha del partido conservando equipo y evento. */
  goBackToMatch: () => void;
};

/** Partido de las pantallas completas (alineación, simulación, partido en directo), leído de
 *  `?teamId=&eventId=` para que sobrevivan a un F5. */
export function useMatchFromUrl(): MatchFromUrl {
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

  const goBackToMatch = () => {
    const qs = new URLSearchParams();
    if (teamId) qs.set("teamId", teamId);
    if (eventId) qs.set("eventId", eventId);
    navigate(`/coach/convocations/match?${qs.toString()}`, { state: { match } });
  };

  return { teamId, eventId, match, isFriendly, loading, goBackToMatch };
}
