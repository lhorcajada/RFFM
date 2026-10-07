import PartidoEnDirectoTab from "./components/PartidoEnDirectoTab";
import FullScreenMatchLayout from "./components/FullScreenMatchLayout";
import { useLiveMatchLineupPlayers } from "./hooks/useLiveMatchLineupPlayers";
import { useMatchFromUrl } from "./hooks/useMatchFromUrl";

/** Pantalla completa del partido en directo: sin cabecera ni pie de la app,
 *  solo una barra mínima con "Volver" para aprovechar todo el alto de la tablet. */
export default function LiveMatchPage() {
  const { teamId, eventId, match, isFriendly, loading, goBackToMatch } = useMatchFromUrl();
  const { lineupPlayers } = useLiveMatchLineupPlayers(teamId, match?.date);

  return (
    <FullScreenMatchLayout onBack={goBackToMatch} loading={loading} notFound={!match || !eventId}>
      {match && eventId && (
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
    </FullScreenMatchLayout>
  );
}
