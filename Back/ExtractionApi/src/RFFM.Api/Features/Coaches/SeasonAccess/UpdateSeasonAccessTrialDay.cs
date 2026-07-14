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
    public class UpdateSeasonAccessTrialDay : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("/api/catalog/season-access/trial-days/{id}",
                    [Authorize(Roles = "Coach,Administrator")]
                    async (string id, UpdateSeasonAccessTrialDayRequest request, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(new UpdateSeasonAccessTrialDayCommand(id, request), cancellationToken);
                        return result is null ? Results.NotFound() : Results.Ok(result);
                    })
                .WithName(nameof(UpdateSeasonAccessTrialDay))
                .WithTags("SeasonAccess")
                .Produces<SeasonAccessTrialDayDto>()
                .Produces(StatusCodes.Status404NotFound)
                .Produces(StatusCodes.Status403Forbidden);
        }

        public record UpdateSeasonAccessTrialDayCommand(string Id, UpdateSeasonAccessTrialDayRequest Request) : RFFM.Api.Common.ICommand<SeasonAccessTrialDayDto?>, IRequireFeaturePermission
        {
            public string FeatureRoute => CoachFeatureRoutes.SeasonAccess;
            public string RequiredPermission => "ReadWrite";
        }

        public class Validator : AbstractValidator<UpdateSeasonAccessTrialDayCommand>
        {
            public Validator()
            {
                RuleFor(x => x.Id).NotEmpty();
            }
        }

        public class Handler : IRequestHandler<UpdateSeasonAccessTrialDayCommand, SeasonAccessTrialDayDto?>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;

            public Handler(AppDbContext db, ICurrentUserService currentUser)
            {
                _db = db;
                _currentUser = currentUser;
            }

            public async ValueTask<SeasonAccessTrialDayDto?> Handle(UpdateSeasonAccessTrialDayCommand command, CancellationToken cancellationToken = default)
            {
                var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("Usuario no autenticado");

                var day = await _db.SeasonAccessTrialDays
                    .Include(x => x.Trial)
                    .FirstOrDefaultAsync(x => x.Id == command.Id, cancellationToken);

                if (day is null || day.Trial?.ApplicationUserId != userId)
                    return null;

                day.Update(command.Request.Date, command.Request.Label);
                await _db.SaveChangesAsync(cancellationToken);

                return day.ToDto();
            }
        }
    }
}
