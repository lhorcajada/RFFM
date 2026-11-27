using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities.Teams;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.DeconvocationProposals
{
    /// <summary>
    /// El entrenador guarda una propuesta de desconvocatoria posible. No cambia la convocatoria.
    /// POST /api/events/{eventId}/deconvocation-proposals
    /// </summary>
    public class SaveDeconvocationProposal : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost(DeconvocationProposalsConstants.BaseRoute,
                    [Authorize(Roles = DeconvocationProposalsConstants.Roles)] async (string eventId, Body body, IMediator mediator, CancellationToken ct) =>
                        Results.Ok(await mediator.Send(new Command(eventId, body.Name, body.TeamPlayerIds), ct)))
                .WithName(nameof(SaveDeconvocationProposal))
                .WithTags(DeconvocationProposalsConstants.Tag)
                .Produces<SavedDeconvocationProposalDto>()
                .ProducesValidationProblem()
                .ProducesProblem(StatusCodes.Status403Forbidden)
                .ProducesProblem(StatusCodes.Status404NotFound)
                .ProducesProblem(StatusCodes.Status409Conflict);
        }

        public record Body(string Name, IReadOnlyList<string> TeamPlayerIds);

        public record Command(string EventId, string Name, IReadOnlyList<string> TeamPlayerIds)
            : RFFM.Api.Common.ICommand<SavedDeconvocationProposalDto>;

        public class Validator : AbstractValidator<Command>
        {
            public Validator()
            {
                RuleFor(c => c.EventId).NotEmpty();
                RuleFor(c => c.Name).NotEmpty().WithMessage("El nombre es obligatorio.")
                    .Must(n => n is null || n.Trim().Length <= DeconvocationSavedProposal.MaxNameLength)
                    .WithMessage($"El nombre admite como máximo {DeconvocationSavedProposal.MaxNameLength} caracteres.");
                RuleFor(c => c.TeamPlayerIds).NotEmpty().WithMessage("La propuesta necesita al menos un jugador.")
                    .Must(ids => ids is null || ids.Distinct().Count() == ids.Count)
                    .WithMessage("No puede haber jugadores repetidos.");
                RuleForEach(c => c.TeamPlayerIds).NotEmpty();
            }
        }

        public class Handler(AppDbContext db, ICurrentUserService currentUser) : IRequestHandler<Command, SavedDeconvocationProposalDto>
        {
            public async ValueTask<SavedDeconvocationProposalDto> Handle(Command request, CancellationToken cancellationToken)
            {
                var teamId = await DeconvocationProposalsSupport.RequireManagedEventTeamAsync(
                    db, currentUser, request.EventId, cancellationToken);

                var playersOfTheTeam = await db.TeamPlayers.AsNoTracking()
                    .CountAsync(p => p.TeamId == teamId && request.TeamPlayerIds.Contains(p.Id), cancellationToken);
                if (playersOfTheTeam != request.TeamPlayerIds.Count)
                    throw new DomainException("Propuesta no válida", "Hay jugadores que no pertenecen al equipo del partido.",
                        ErrorCodes.DeconvocationProposalPlayerNotInTeam);

                var savedCount = await db.DeconvocationSavedProposals
                    .CountAsync(p => p.SportEventId == request.EventId, cancellationToken);
                if (savedCount >= DeconvocationSavedProposal.MaxPerEvent)
                    throw new ConflictException(
                        $"El partido ya tiene {DeconvocationSavedProposal.MaxPerEvent} propuestas guardadas. Borra alguna para guardar otra.",
                        ErrorCodes.DeconvocationProposalLimitReached);

                var proposal = DeconvocationSavedProposal.Create(request.EventId, request.Name, request.TeamPlayerIds.ToList());
                db.DeconvocationSavedProposals.Add(proposal);
                await db.SaveChangesAsync(cancellationToken);

                return new SavedDeconvocationProposalDto(proposal.Id, proposal.Name, proposal.TeamPlayerIds, proposal.CreatedOn);
            }
        }
    }
}
