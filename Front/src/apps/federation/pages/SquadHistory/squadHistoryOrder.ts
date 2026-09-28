import type { SquadHistoryPlayer, SquadHistoryTeam } from "../../services/squadHistoryService";

type MainTeam = { seasonId: number; team: SquadHistoryTeam };

const collator = new Intl.Collator("es", { sensitivity: "base" });

function callUps(team: SquadHistoryTeam): number {
  return team.callUps ?? -1;
}

export function sortTeamsByCallUps(teams: SquadHistoryTeam[]): SquadHistoryTeam[] {
  return [...teams].sort((a, b) => callUps(b) - callUps(a));
}

/** Equipo de referencia del jugador: el de más convocatorias en la temporada más reciente en la que jugó. */
function mainTeam(player: SquadHistoryPlayer): MainTeam | null {
  const seasons = [...player.seasons].sort((a, b) => b.seasonId - a.seasonId);
  for (const season of seasons) {
    const teams = sortTeamsByCallUps(season.teams.filter((t) => t.teamCode));
    if (teams.length > 0) return { seasonId: season.seasonId, team: teams[0] };
  }
  return null;
}

export function sortPlayers(players: SquadHistoryPlayer[]): SquadHistoryPlayer[] {
  const keyed = players.map((player) => ({ player, main: mainTeam(player) }));
  keyed.sort((a, b) => {
    if (!a.main || !b.main) {
      if (a.main !== b.main) return a.main ? -1 : 1;
      return collator.compare(a.player.playerName, b.player.playerName);
    }
    return (
      b.main.seasonId - a.main.seasonId ||
      collator.compare(a.main.team.competitionName, b.main.team.competitionName) ||
      collator.compare(a.main.team.teamName, b.main.team.teamName) ||
      collator.compare(a.player.playerName, b.player.playerName)
    );
  });
  return keyed.map((k) => k.player);
}
