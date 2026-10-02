using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using static RFFM.Api.Features.Coaches.PlayerTracking.GetTrackingComments;

namespace RFFM.Api.Features.Coaches.PlayerTracking
{
    /// <summary>
    /// Añade un comentario evaluable al catálogo del equipo. El título es único en el equipo sin distinguir
    /// mayúsculas. Solo el entrenador.
    /// POST /api/teams/{teamId}/tracking-comments
    /// </summary>
    public class CreateTrackingComment : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/teams/{teamId}/tracking-comments",
                    async (string teamId, Command command, IMediator mediator, CancellationToken ct) =>
                    {
                        var result = await mediator.Send(command with { TeamId = teamId }, ct);
                        return Results.Created($"/api/teams/{teamId}/tracking-comments/{result.Id}", result);
                    })
                .WithName(nameof(CreateTrackingComment))
                .WithTags(PlayerTrackingConstants.Tag)
                .RequireAuthorization(new AuthorizeAttribute { Roles = PlayerTrackingConstants.AllowedRoles })
                .Produces<TrackingCommentDto>(StatusCodes.Status201Created)
                .ProducesValidationProblem()
                .ProducesProblem(StatusCodes.Status403Forbidden)
                .ProducesProblem(StatusCodes.Status409Conflict);
        }

        public record Command : RFFM.Api.Common.ICommand<TrackingCommentDto>, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string TeamId { get; init; } = null!;
            public string Title { get; init; } = null!;
            public string? Description { get; init; }
            public string FeatureRoute => CoachFeatureRoutes.GameModel;
            public string RequiredPermission => "ReadWrite";
        }

        public class Validator : AbstractValidator<Command>
        {
            public Validator()
            {
                RuleFor(c => c.TeamId).NotEmpty();
                RuleFor(c => c.Title)
                    .Must(t => !string.IsNullOrWhiteSpace(t)).WithMessage("El título es obligatorio.")
                    .Must(t => t is null || t.Trim().Length <= TrackingComment.Rules.TitleMaxLength)
                    .WithMessage($"El título no puede superar {TrackingComment.Rules.TitleMaxLength} caracteres.");
                RuleFor(c => c.Description)
                    .Must(d => d is null || d.Trim().Length <= TrackingComment.Rules.DescriptionMaxLength)
                    .WithMessage($"La descripción no puede superar {TrackingComment.Rules.DescriptionMaxLength} caracteres.");
            }
        }

        public class Handler(AppDbContext db, ICurrentUserService currentUser) : IRequestHandler<Command, TrackingCommentDto>
        {
            public async ValueTask<TrackingCommentDto> Handle(Command request, CancellationToken cancellationToken)
            {
                var normalizedTitle = request.Title.Trim().ToLower();
                var exists = await db.TrackingComments
                    .AsNoTracking()
                    .AnyAsync(c => c.TeamId == request.TeamId && c.Title.ToLower() == normalizedTitle, cancellationToken);
                if (exists)
                    throw new ConflictException($"Ya existe el comentario «{request.Title.Trim()}» en el equipo.",
                        ErrorCodes.TrackingCommentDuplicated);

                var comment = TrackingComment.Create(
                    request.TeamId, request.Title, request.Description, currentUser.UserId ?? throw new UnauthorizedAccessException());
                db.TrackingComments.Add(comment);
                await db.SaveChangesAsync(cancellationToken);

                return ToDto(comment);
            }
        }
    }
}
