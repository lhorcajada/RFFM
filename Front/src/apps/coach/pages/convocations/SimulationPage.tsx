import SimulacionTab from "./components/SimulacionTab";
import FullScreenMatchLayout from "./components/FullScreenMatchLayout";
import { useLiveMatchLineupPlayers } from "./hooks/useLiveMatchLineupPlayers";
import { useMatchFromUrl } from "./hooks/useMatchFromUrl";

/** Pantalla completa de la simulación del partido, con el mismo formato que el partido en directo. */
export default function SimulationPage() {
  const { teamId, eventId, match, isFriendly, loading, goBackToMatch } = useMatchFromUrl();
  const { lineupPlayers } = useLiveMatchLineupPlayers(teamId, match?.date);

  return (
    <FullScreenMatchLayout onBack={goBackToMatch} loading={loading} notFound={!match || !eventId}>
      {match && eventId && (
        <SimulacionTab teamId={teamId} eventId={eventId} lineupPlayers={lineupPlayers} isFriendly={isFriendly} />
      )}
    </FullScreenMatchLayout>
  );
}
