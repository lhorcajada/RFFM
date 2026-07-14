using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Entities.SeasonAccess;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.SeasonAccess
{
    public class CreateSeasonAccessTrialDay : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/catalog/season-access/trial-days",
                    [Authorize(Roles = "Coach,Administrator")]
                    async (CreateSeasonAccessTrialDayRequest request, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(new CreateSeasonAccessTrialDayCommand(request), cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(CreateSeasonAccessTrialDay))
                .WithTags("SeasonAccess")
                .Produces<SeasonAccessTrialDayDto>()
                .Produces(StatusCodes.Status403Forbidden);
        }

        public record CreateSeasonAccessTrialDayCommand(CreateSeasonAccessTrialDayRequest Request) : RFFM.Api.Common.ICommand<SeasonAccessTrialDayDto>, IRequireFeaturePermission
        {
            public string FeatureRoute => CoachFeatureRoutes.SeasonAccess;
            public string RequiredPermission => "ReadWrite";
        }

        public class Validator : AbstractValidator<CreateSeasonAccessTrialDayCommand>
        {
            public Validator()
            {
                RuleFor(x => x.Request.SeasonId).NotEmpty();
                RuleFor(x => x.Request.GeneralCategory).NotEmpty();
            }
        }

        public class Handler : IRequestHandler<CreateSeasonAccessTrialDayCommand, SeasonAccessTrialDayDto>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;

            public Handler(AppDbContext db, ICurrentUserService currentUser)
            {
                _db = db;
                _currentUser = currentUser;
            }

            public async ValueTask<SeasonAccessTrialDayDto> Handle(CreateSeasonAccessTrialDayCommand command, CancellationToken cancellationToken = default)
            {
                var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("Usuario no autenticado");
                var request = command.Request;

                var trial = await _db.SeasonAccessTrials
                    .FirstOrDefaultAsync(
                        x => x.ApplicationUserId == userId && x.SeasonId == request.SeasonId && x.Category == request.GeneralCategory,
                        cancellationToken);

                if (trial is null)
                {
                    trial = SeasonAccessTrial.Create(userId, request.SeasonId, request.GeneralCategory);
                    _db.SeasonAccessTrials.Add(trial);
                    await _db.SaveChangesAsync(cancellationToken);
                }

                var day = SeasonAccessTrialDay.Create(trial.Id, request.Date, request.Label);
                _db.SeasonAccessTrialDays.Add(day);
                await _db.SaveChangesAsync(cancellationToken);

                return day.ToDto();
            }
        }
    }
}
