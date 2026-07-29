using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Federation.Competitions.Services;
using RFFM.Api.Infrastructure.Persistence;
using System.Globalization;

namespace RFFM.Api.Features.Mobile.Competitions.Queries
{
    /// <summary>
    /// Returns the league classification table for the requested team's own RFFM
    /// competition/group (Team.RffmCompetitionId/RffmGroupId — the external RFFM catalog, not
    /// the local Liga/Grupo catalog). If the team is not yet associated with a competition
    /// (either id is null), returns an explicit empty result instead of calling the scrape.
    /// </summary>
    public class GetTeamClassification : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet(
                    "/api/mobile/teams/{teamId}/classification",
                    async (string teamId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(
                            new MobileClassificationQuery { TeamId = teamId },
                            cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(GetTeamClassification))
                .WithTags("Mobile")
                .Produces<MobileClassificationDto>();
        }

        // ─── Query ────────────────────────────────────────────────────────────

        public record MobileClassificationQuery : IQueryApp<MobileClassificationDto>, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string TeamId { get; set; } = null!;

            public string FeatureRoute => CoachFeatureRoutes.CompetitionData;
            public string RequiredPermission => "Read";
        }

        public record MobileClassificationDto(List<MobileClassificationRowDto> Teams);

        public record MobileClassificationRowDto(
            int Position,
            string TeamId,
            string TeamName,
            string ImageUrl,
            int Played,
            int Won,
            int Drawn,
            int Lost,
            int GoalsFor,
            int GoalsAgainst,
            int Points);

        // ─── Handler ──────────────────────────────────────────────────────────

        public class Handler(AppDbContext db, ICompetitionService competitionService)
            : IRequestHandler<MobileClassificationQuery, MobileClassificationDto>
        {
            public async ValueTask<MobileClassificationDto> Handle(MobileClassificationQuery request, CancellationToken cancellationToken)
            {
                var team = await db.Teams
                    .AsNoTracking()
                    .SingleOrDefaultAsync(t => t.Id == request.TeamId, cancellationToken);

                if (team == null)
                    throw new DomainException("Equipo", "Equipo no encontrado", "TeamNotFound");

                if (team.RffmCompetitionId == null || team.RffmGroupId == null)
                    return new MobileClassificationDto([]);

                var classification = await competitionService.GetClassification(team.RffmGroupId.Value, cancellationToken);

                var rows = classification.Teams
                    .Select(t => new MobileClassificationRowDto(
                        ParseIntOrDefault(t.Position),
                        t.TeamId,
                        t.TeamName,
                        t.ImageUrl,
                        ParseIntOrDefault(t.Played),
                        ParseIntOrDefault(t.Won),
                        ParseIntOrDefault(t.Drawn),
                        ParseIntOrDefault(t.Lost),
                        ParseIntOrDefault(t.GoalsFor),
                        ParseIntOrDefault(t.GoalsAgainst),
                        ParseIntOrDefault(t.Points)))
                    .ToList();

                return new MobileClassificationDto(rows);
            }

            /// <summary>
            /// RFFM's scraped classification returns every numeric field as a string. Parses it
            /// to int with a safe 0 fallback for empty/malformed values.
            /// </summary>
            private static int ParseIntOrDefault(string? value)
                => int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed) ? parsed : 0;
        }
    }
}
