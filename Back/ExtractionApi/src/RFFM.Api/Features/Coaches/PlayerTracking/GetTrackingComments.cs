using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.PlayerTracking
{
    /// <summary>
    /// Catálogo de comentarios evaluables del equipo, ordenado por título. Solo el entrenador.
    /// GET /api/teams/{teamId}/tracking-comments
    /// See openspec/changes/player-session-tracking-comments-api/design.md → D3.
    /// </summary>
    public class GetTrackingComments : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/teams/{teamId}/tracking-comments",
                    async (string teamId, IMediator mediator, CancellationToken ct) =>
                        Results.Ok(await mediator.Send(new Query { TeamId = teamId }, ct)))
                .WithName(nameof(GetTrackingComments))
                .WithTags(PlayerTrackingConstants.Tag)
                .RequireAuthorization(new AuthorizeAttribute { Roles = PlayerTrackingConstants.AllowedRoles })
                .Produces<TrackingCommentDto[]>()
                .ProducesProblem(StatusCodes.Status403Forbidden);
        }

        public record Query : IQueryApp<TrackingCommentDto[]>, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string TeamId { get; init; } = null!;
            public string FeatureRoute => CoachFeatureRoutes.GameModel;
            public string RequiredPermission => "Read";
        }

        public class Validator : AbstractValidator<Query>
        {
            public Validator()
            {
                RuleFor(q => q.TeamId).NotEmpty();
            }
        }

        public record TrackingCommentDto(string Id, string Title, string? Description);

        internal static TrackingCommentDto ToDto(TrackingComment c) => new(c.Id, c.Title, c.Description);

        public class Handler(AppDbContext db) : IRequestHandler<Query, TrackingCommentDto[]>
        {
            public async ValueTask<TrackingCommentDto[]> Handle(Query request, CancellationToken cancellationToken)
            {
                var comments = await db.TrackingComments
                    .AsNoTracking()
                    .Where(c => c.TeamId == request.TeamId)
                    .OrderBy(c => c.Title)
                    .ToListAsync(cancellationToken);

                return comments.Select(ToDto).ToArray();
            }
        }
    }
}
