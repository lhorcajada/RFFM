namespace RFFM.Api.Features.Federation.Players.Models;

public record SeasonStats(int Called, int Starter, int Substitute, int Played, int Goals, int Yellow, int Red, int DoubleYellow)
{
    public static SeasonStats From(Player player) => new(
        player.Matches.Called,
        player.Matches.Starter,
        player.Matches.Substitute,
        player.Matches.Played,
        player.Matches.TotalGoals,
        player.Cards.Yellow,
        player.Cards.Red,
        player.Cards.DoubleYellow);
}
