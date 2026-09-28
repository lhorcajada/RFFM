using System.Globalization;
using System.Text;
using Microsoft.Extensions.Logging;
using RFFM.Api.Domain.Entities.Federation.SquadHistory;
using RFFM.Api.Features.Federation.Players.Models;
using RFFM.Api.Features.Federation.Teams.Models;

namespace RFFM.Api.Features.Federation.SquadHistory.Services
{
    public record SquadCandidate(string PlayerCode, string PlayerName, int BirthYear, string OriginTeamName, Player PreviousSeasonSheet);

    public record SquadCandidateSearchResult(IReadOnlyList<SquadCandidate> Candidates, string? Note);

    public interface ISquadCandidateFinder
    {
        Task<SquadCandidateSearchResult> FindAsync(TeamRffm targetTeam, int targetSeasonStartYear, int previousSeasonId,
            CancellationToken cancellationToken);
    }

    /// <summary>
    /// Para un equipo sin jugadores, propone jugadores del mismo club que en la temporada anterior
    /// jugaron en su categoría o en la inferior y cuyo año de nacimiento encaja en la categoría destino.
    /// La ficha de equipo de la RFFM solo muestra la plantilla actual, así que la de la temporada anterior
    /// se reconstruye con las últimas actas de cada equipo en su grupo de esa temporada.
    /// </summary>
    public class SquadCandidateFinder(IRffmBackgroundClient rffm, ILogger<SquadCandidateFinder> logger) : ISquadCandidateFinder
    {
        private const int ActasPerTeam = 2;

        private record SourceTeam(string TeamCode, string TeamName, FootballCategory Category, string CompetitionCode, string GroupCode);

        public async Task<SquadCandidateSearchResult> FindAsync(TeamRffm targetTeam, int targetSeasonStartYear, int previousSeasonId,
            CancellationToken cancellationToken)
        {
            var categoryText = string.IsNullOrWhiteSpace(targetTeam.Category) ? targetTeam.TeamName : targetTeam.Category;
            var hasCategory = FootballCategory.TryDetect(categoryText, out var category);
            if (!hasCategory || category is null)
                return Empty($"No se buscan posibles jugadores: la categoría del equipo ({targetTeam.Category}) no está soportada.");

            if (string.IsNullOrWhiteSpace(targetTeam.ClubCode))
                return Empty("No se buscan posibles jugadores: la RFFM no indica el club del equipo.");

            var isFemale = FootballCategory.IsFemale(targetTeam.Category) || FootballCategory.IsFemale(targetTeam.TeamName);
            var sourceCategories = category.CandidateSources;

            var (sourceTeams, note) = await FindSourceTeamsAsync(targetTeam, previousSeasonId, sourceCategories, isFemale, cancellationToken);

            var players = await CollectPlayersAsync(sourceTeams, sourceCategories, previousSeasonId, cancellationToken);
            var candidates = new List<SquadCandidate>();
            foreach (var (playerCode, playerName, originTeamName) in players)
            {
                var sheet = await TryGetSheetAsync(playerCode, previousSeasonId, cancellationToken);
                var birthYear = sheet?.BirthYear ?? 0;
                var fitsCategory = birthYear > 0 && category.IncludesBirthYear(birthYear, targetSeasonStartYear);
                if (fitsCategory)
                    candidates.Add(new SquadCandidate(playerCode, playerName, birthYear, originTeamName, sheet!));
            }

            return new SquadCandidateSearchResult(candidates, note);
        }

        private async Task<(List<SourceTeam> Teams, string? Note)> FindSourceTeamsAsync(TeamRffm targetTeam, int previousSeasonId,
            IReadOnlyList<FootballCategory> sourceCategories, bool isFemale, CancellationToken cancellationToken)
        {
            HashSet<string>? clubTeamCodes = null;
            try
            {
                var clubTeams = await rffm.GetClubTeamsAsync(targetTeam.ClubCode.Trim(), previousSeasonId, cancellationToken);
                if (clubTeams.Count > 0)
                    clubTeamCodes = clubTeams
                        .Where(t => IsSourceCategory($"{t.CategoryDescription} {t.TeamName}", sourceCategories, isFemale))
                        .Select(t => t.TeamCode.Trim())
                        .ToHashSet(StringComparer.OrdinalIgnoreCase);
            }
            catch (Exception ex) when (RffmErrors.IsRecoverableOrCircuitOpen(ex))
            {
                logger.LogWarning(ex, "La ficha del club {ClubCode} no respondió; se buscan sus equipos por nombre", targetTeam.ClubCode);
            }

            if (clubTeamCodes is { Count: 0 }) return ([], null);

            var clubKey = NameKey(targetTeam.ClubName);
            Func<RffmGroupTeam, bool> belongsToClub = clubTeamCodes != null
                ? t => clubTeamCodes.Contains(t.TeamCode.Trim())
                : t => clubKey.Length > 0 && NameKey(t.TeamName).StartsWith(clubKey, StringComparison.Ordinal);
            var note = clubTeamCodes == null
                ? "Los equipos del club se identificaron por su nombre en las competiciones de la temporada anterior (la ficha del club no respondió)."
                : null;

            try
            {
                var teams = await LocateInPreviousSeasonGroupsAsync(previousSeasonId, sourceCategories, isFemale, belongsToClub,
                    clubTeamCodes?.Count, cancellationToken);
                return (teams, note);
            }
            catch (Exception ex) when (RffmErrors.IsRecoverableOrCircuitOpen(ex))
            {
                logger.LogWarning(ex, "No se pudieron consultar las competiciones de la temporada {SeasonId}", previousSeasonId);
                return ([], "No se pudieron consultar las competiciones de la temporada anterior.");
            }
        }

        private async Task<List<SourceTeam>> LocateInPreviousSeasonGroupsAsync(int previousSeasonId,
            IReadOnlyList<FootballCategory> sourceCategories, bool isFemale, Func<RffmGroupTeam, bool> belongsToClub,
            int? expectedTeams, CancellationToken cancellationToken)
        {
            var found = new Dictionary<string, SourceTeam>(StringComparer.OrdinalIgnoreCase);
            var competitions = await rffm.GetCompetitionsAsync(previousSeasonId, cancellationToken);
            foreach (var competition in competitions)
            {
                var competitionText = $"{competition.Name} {competition.CategoryGroup}";
                var hasCategory = FootballCategory.TryDetect(competition.Name, out var competitionCategory);
                var isSourceCompetition = hasCategory && sourceCategories.Contains(competitionCategory!) &&
                                          FootballCategory.IsFemale(competitionText) == isFemale;
                if (!isSourceCompetition) continue;

                foreach (var group in await rffm.GetGroupsAsync(competition.Code, cancellationToken))
                {
                    var groupTeams = await rffm.GetGroupTeamsAsync(group.Code, cancellationToken);
                    foreach (var team in groupTeams.Where(belongsToClub))
                        found.TryAdd(team.TeamCode.Trim(),
                            new SourceTeam(team.TeamCode.Trim(), team.TeamName.Trim(), competitionCategory!, competition.Code, group.Code));

                    var allFound = expectedTeams.HasValue && found.Count >= expectedTeams.Value;
                    if (allFound) return found.Values.ToList();
                }
            }

            return found.Values.ToList();
        }

        private async Task<List<(string PlayerCode, string PlayerName, string OriginTeamName)>> CollectPlayersAsync(
            List<SourceTeam> sourceTeams, IReadOnlyList<FootballCategory> sourceCategories, int previousSeasonId,
            CancellationToken cancellationToken)
        {
            var players = new Dictionary<string, (string PlayerCode, string PlayerName, string OriginTeamName)>(StringComparer.OrdinalIgnoreCase);
            var orderedTeams = sourceTeams.OrderBy(t => sourceCategories.ToList().IndexOf(t.Category));

            foreach (var team in orderedTeams)
            {
                foreach (var lineupPlayer in await GetLastLineupsAsync(team, previousSeasonId, cancellationToken))
                {
                    var code = lineupPlayer.PlayerCode?.Trim();
                    if (string.IsNullOrEmpty(code) || players.ContainsKey(code)) continue;
                    players[code] = (code, lineupPlayer.PlayerName?.Trim() ?? string.Empty, team.TeamName);
                }
            }

            return players.Values.ToList();
        }

        private async Task<List<LineupPlayer>> GetLastLineupsAsync(SourceTeam team, int previousSeasonId, CancellationToken cancellationToken)
        {
            IReadOnlyList<RffmGroupMatch> matches;
            try
            {
                matches = await rffm.GetTeamLastPlayedMatchesAsync(team.GroupCode, team.TeamCode, ActasPerTeam, cancellationToken);
            }
            catch (Exception ex) when (RffmErrors.IsRecoverableOrCircuitOpen(ex))
            {
                logger.LogWarning(ex, "No se pudo obtener el calendario del equipo origen {TeamCode}", team.TeamCode);
                return [];
            }

            var lineups = new List<LineupPlayer>();
            foreach (var match in matches)
            {
                try
                {
                    var acta = await rffm.GetActaAsync(match.RecordCode, previousSeasonId, team.CompetitionCode, team.GroupCode, cancellationToken);
                    if (acta == null) continue;
                    var isHome = string.Equals(match.LocalTeamCode.Trim(), team.TeamCode, StringComparison.OrdinalIgnoreCase);
                    lineups.AddRange((isHome ? acta.LocalPlayers : acta.AwayPlayers) ?? []);
                }
                catch (Exception ex) when (RffmErrors.IsRecoverableOrCircuitOpen(ex))
                {
                    logger.LogWarning(ex, "No se pudo obtener el acta {RecordCode} del equipo origen {TeamCode}", match.RecordCode, team.TeamCode);
                }
            }

            return lineups;
        }

        private async Task<Player?> TryGetSheetAsync(string playerCode, int seasonId, CancellationToken cancellationToken)
        {
            try
            {
                return await rffm.GetPlayerSheetAsync(playerCode, seasonId, cancellationToken);
            }
            catch (Exception ex) when (RffmErrors.IsRecoverableOrCircuitOpen(ex))
            {
                logger.LogWarning(ex, "No se pudo obtener la ficha del posible jugador {PlayerCode}", playerCode);
                return null;
            }
        }

        private static bool IsSourceCategory(string categoryText, IReadOnlyList<FootballCategory> sourceCategories, bool isFemale)
        {
            var hasCategory = FootballCategory.TryDetect(categoryText, out var teamCategory);
            return hasCategory && sourceCategories.Contains(teamCategory!) && FootballCategory.IsFemale(categoryText) == isFemale;
        }

        /// <summary>Nombre sin tildes ni signos, solo letras y dígitos: "C.F. ALCOBENDAS 'A'" → "CFALCOBENDASA".</summary>
        private static string NameKey(string? name)
        {
            if (string.IsNullOrWhiteSpace(name)) return string.Empty;
            var decomposed = name.ToUpperInvariant().Normalize(NormalizationForm.FormD);
            return new string(decomposed
                .Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark && char.IsLetterOrDigit(c))
                .ToArray());
        }

        private static SquadCandidateSearchResult Empty(string note) => new([], note);
    }
}
