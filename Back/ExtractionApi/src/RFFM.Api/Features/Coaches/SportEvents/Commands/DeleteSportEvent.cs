using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.SportEvents.Commands
{
    public class DeleteSportEvent : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete("api/sport-events/{id}",
                    async (string id, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var request = new DeleteSportEventCommand { SportEventId = id };
                        await mediator.Send(request, cancellationToken);
                        return Results.Ok();
                    })
                .WithName(nameof(DeleteSportEvent))
                .WithTags("SportEventsFeature")
                .Produces(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict);
        }
    }

    public class DeleteSportEventCommand : IRequest
    {
        public string SportEventId { get; set; } = string.Empty;
    }

    public class DeleteSportEventHandler : IRequestHandler<DeleteSportEventCommand, Unit>
    {
        private readonly AppDbContext _db;

        public DeleteSportEventHandler(AppDbContext db)
        {
            _db = db;
        }

        public async ValueTask<Unit> Handle(DeleteSportEventCommand request, CancellationToken cancellationToken)
        {
            var ev = await _db.SportEvents.FirstOrDefaultAsync(s => s.Id == request.SportEventId, cancellationToken: cancellationToken);
            if (ev == null)
                throw new KeyNotFoundException($"SportEvent '{request.SportEventId}' Not Found");

            _db.SportEvents.Remove(ev);
            await _db.SaveChangesAsync(cancellationToken);
            return Unit.Value;
        }
    }

    public class DeleteSportEventValidator : AbstractValidator<DeleteSportEventCommand>
    {
        public DeleteSportEventValidator()
        {
            RuleFor(x => x.SportEventId).NotEmpty();
        }
    }
}
