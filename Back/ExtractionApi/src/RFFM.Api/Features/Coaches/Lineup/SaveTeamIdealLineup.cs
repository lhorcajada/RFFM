using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Lineup
{
    public class SaveTeamIdealLineup : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/catalog/team/{teamId}/ideal-lineup",
                    async (string teamId, SaveLineupRequest req, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(new SaveLineupCommand(teamId, req), cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(SaveTeamIdealLineup))
                .WithTags("Lineup")
                .RequireAuthorization()
                .Produces<SaveLineupResponse>();
        }

        public record SlotRequest(int SlotIndex, string? TeamPlayerId);

        public record SaveLineupRequest(
            string FormationId,
            string? SeasonId,
            IEnumerable<SlotRequest> Slots
        );

        public record SaveLineupCommand(string TeamId, SaveLineupRequest Request) : RFFM.Api.Common.ICommand<SaveLineupResponse>;

        public record SaveLineupResponse(string Id, string FormationId);

        public class Validator : AbstractValidator<SaveLineupCommand>
        {
            public Validator()
            {
                RuleFor(x => x.TeamId).NotEmpty();
                RuleFor(x => x.Request.FormationId).NotEmpty();
                RuleFor(x => x.Request.Slots)
                    .Must(slots => slots != null && slots.All(s => s.SlotIndex >= 0 && s.SlotIndex <= 10))
                    .WithMessage("Slot indices must be between 0 and 10.");
            }
        }

        public class Handler : IRequestHandler<SaveLineupCommand, SaveLineupResponse>
        {
            private readonly AppDbContext _db;

            public Handler(AppDbContext db)
            {
                _db = db;
            }

            public async ValueTask<SaveLineupResponse> Handle(SaveLineupCommand command, CancellationToken cancellationToken = default)
            {
                var req = command.Request;

                var existing = await _db.TeamIdealLineups
                    .Include(l => l.Slots)
                    .Where(l => l.TeamId == command.TeamId && l.SeasonId == req.SeasonId)
                    .FirstOrDefaultAsync(cancellationToken);

                if (existing is null)
                {
                    existing = TeamIdealLineup.Create(command.TeamId, req.SeasonId ?? string.Empty, req.FormationId);
                    _db.TeamIdealLineups.Add(existing);
                    await _db.SaveChangesAsync(cancellationToken);
                }
                else
                {
                    existing.UpdateFormation(req.FormationId);
                    _db.TeamIdealLineupSlots.RemoveRange(existing.Slots);
                    await _db.SaveChangesAsync(cancellationToken);
                }

                var slots = req.Slots
                    .Select(s => TeamIdealLineupSlot.Create(existing.Id, s.SlotIndex, s.TeamPlayerId))
                    .ToList();

                _db.TeamIdealLineupSlots.AddRange(slots);
                await _db.SaveChangesAsync(cancellationToken);

                return new SaveLineupResponse(existing.Id, existing.FormationId);
            }
        }
    }
}
