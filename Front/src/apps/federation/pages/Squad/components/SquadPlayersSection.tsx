import React from "react";
import PlayersContainer from "../../../components/players/PlayersContainer/PlayersContainer";
import PlayerRow from "./PlayerRow";
import ComparedPlayerCard from "./ComparedPlayerCard";
import type { Player } from "../playersTypes";
import type { CoachSquadComparison } from "../../../services/squadComparisonService";

type Props = {
  season: string;
  teamName?: string;
  players: Player[];
  comparison: CoachSquadComparison | null;
};

export default function SquadPlayersSection({ season, teamName, players, comparison }: Props) {
  if (comparison?.isCoachTeam) {
    return (
      <PlayersContainer
        title={`${teamName ?? comparison.teamName ?? "Jugadores"} · Mi equipo`}
        count={comparison.players.length}
      >
        {comparison.players.map((p) => (
          <ComparedPlayerCard
            key={p.teamPlayerId ?? `rffm-${p.rffmPlayerId ?? p.name}`}
            player={p}
            season={season}
          />
        ))}
      </PlayersContainer>
    );
  }

  return (
    <PlayersContainer
      title={teamName ?? "Jugadores"}
      count={teamName ? players.length : 0}
    >
      {players.map((p) => (
        <div key={p.id}>
          <PlayerRow player={p} season={season} />
        </div>
      ))}
    </PlayersContainer>
  );
}
