using System.Globalization;
using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Caching.Memory;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Federation.Clubs.Models;
using RFFM.Api.Features.Federation.Clubs.Services;
using RFFM.Api.Features.Federation.Competitions.Services;

namespace RFFM.Api.Features.Federation.Clubs.Queries
{
    public class FederationGetClubTeams : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/clubs/{clubCode}/teams",
                    async (
                        string clubCode,
                        IClubDirectoryService clubDirectoryService,
                        ICompetitionService competitionService,
                        IMemoryCache cache,
                        CancellationToken cancellationToken) =>
                    {
                        var normalizedClubCode = (clubCode ?? string.Empty).Trim();
                        if (string.IsNullOrWhiteSpace(normalizedClubCode))
                            return Results.BadRequest("clubCode es obligatorio");

                        var teamsCacheKey = $"clubs_{normalizedClubCode}_teams";
                        var teams = await cache.GetOrCreateAsync(teamsCacheKey, async entry =>
                        {
                            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10);
                            return await clubDirectoryService.GetClubTeamsAsync(normalizedClubCode, cancellationToken);
                        });

                        var competitionsCacheKey = "competitions_all";
                        var competitions = await cache.GetOrCreateAsync(competitionsCacheKey, async entry =>
                        {
                            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10);
                            return await competitionService.GetCompetitionsAsync(cancellationToken);
                        });

                        var competitionLookup = (competitions ?? Array.Empty<ResponseCompetition>())
                            .Where(c => !string.IsNullOrWhiteSpace(c.Name))
                            .GroupBy(c => NormalizeKey(c.Name))
                            .ToDictionary(g => g.Key, g => g.First());

                        var response = (teams ?? Array.Empty<ClubTeamDirectoryItem>())
                            .Select(t =>
                            {
                                var categoryKey = NormalizeKey(t.CategoryDescription);
                                var match = competitionLookup.TryGetValue(categoryKey, out var comp) ? comp : null;

                                return new ResponseClubTeam(
                                    TeamCode: t.TeamCode,
                                    TeamName: t.TeamName,
                                    CategoryDescription: t.CategoryDescription,
                                    InCompetition: t.InCompetition,
                                    CompetitionId: match?.CompetitionId,
                                    CompetitionName: match?.Name);
                            })
                            .ToArray();

                        return Results.Ok(response);
                    })
                .RequireAuthorization()
                .WithName(nameof(FederationGetClubTeams))
                .WithTags(ClubsConstants.ClubsFeature)
                .Produces<ResponseClubTeam[]>()
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest);
        }

        public record ResponseClubTeam(
            string TeamCode,
            string TeamName,
            string CategoryDescription,
            bool InCompetition,
            int? CompetitionId,
            string? CompetitionName);

        private static string NormalizeKey(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
                return string.Empty;

            var normalized = value.Trim().ToUpperInvariant();
            normalized = normalized.Normalize(NormalizationForm.FormD);

            var chars = normalized
                .Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                .Select(c => c switch
                {
                    '\u2019' => '\'',
                    _ => c
                })
                .ToArray();

            var withoutDiacritics = new string(chars).Normalize(NormalizationForm.FormC);

            withoutDiacritics = withoutDiacritics
                .Replace("'", string.Empty)
                .Replace("\"", string.Empty)
                .Replace("·", " ");

            while (withoutDiacritics.Contains("  ", StringComparison.Ordinal))
                withoutDiacritics = withoutDiacritics.Replace("  ", " ");

            return withoutDiacritics;
        }
    }
}
