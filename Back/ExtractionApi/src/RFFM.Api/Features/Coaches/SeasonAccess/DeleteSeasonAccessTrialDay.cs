using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.SeasonAccess
{
    public class DeleteSeasonAccessTrialDay : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete("/api/catalog/season-access/trial-days/{id}",
                    [Authorize(Roles = "Coach,Administrator")]
                    async (string id, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(new DeleteSeasonAccessTrialDayCommand(id), cancellationToken);
                        return result is null ? Results.NotFound() : Results.NoContent();
                    })
                .WithName(nameof(DeleteSeasonAccessTrialDay))
                .WithTags("SeasonAccess")
                .Produces(StatusCodes.Status204NoContent)
                .Produces(StatusCodes.Status404NotFound)
                .Produces(StatusCodes.Status403Forbidden);
        }

        public record DeleteSeasonAccessTrialDayCommand(string Id) : RFFM.Api.Common.ICommand<SeasonAccessTrialDayDto?>, IRequireFeaturePermission
        {
            public string FeatureRoute => CoachFeatureRoutes.SeasonAccess;
            public string RequiredPermission => "ReadWrite";
        }

        public class Validator : AbstractValidator<DeleteSeasonAccessTrialDayCommand>
        {
            public Validator()
            {
                RuleFor(x => x.Id).NotEmpty();
            }
        }

        public class Handler : IRequestHandler<DeleteSeasonAccessTrialDayCommand, SeasonAccessTrialDayDto?>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;

            public Handler(AppDbContext db, ICurrentUserService currentUser)
            {
                _db = db;
                _currentUser = currentUser;
            }

            public async ValueTask<SeasonAccessTrialDayDto?> Handle(DeleteSeasonAccessTrialDayCommand command, CancellationToken cancellationToken = default)
            {
                var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("Usuario no autenticado");

                var day = await _db.SeasonAccessTrialDays
                    .Include(x => x.Trial)
                    .FirstOrDefaultAsync(x => x.Id == command.Id, cancellationToken);

                if (day is null || day.Trial?.ApplicationUserId != userId)
                    return null;

                var dto = day.ToDto();
                _db.SeasonAccessTrialDays.Remove(day);
                await _db.SaveChangesAsync(cancellationToken);

                return dto;
            }
        }
    }
}
