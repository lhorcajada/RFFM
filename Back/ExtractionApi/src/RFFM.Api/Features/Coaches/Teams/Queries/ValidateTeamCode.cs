using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Teams.Queries
{
    public class ValidateTeamCode : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/team/by-code/{code}",
                    async (string code, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(new ValidateTeamCodeQuery(code), cancellationToken);
                        return result is null
                            ? Results.NotFound()
                            : Results.Ok(result);
                    })
                .WithName(nameof(ValidateTeamCode))
                .WithTags(TeamConstants.TeamFeature)
                .Produces<ValidateTeamCodeResponse>()
                .Produces(StatusCodes.Status404NotFound)
                .RequireAuthorization();
        }

        public record ValidateTeamCodeQuery(string Code) : IRequest<ValidateTeamCodeResponse?>;

        public record ValidateTeamCodeResponse(string TeamId, string TeamName);

        public class ValidateTeamCodeHandler : IRequestHandler<ValidateTeamCodeQuery, ValidateTeamCodeResponse?>
        {
            private readonly AppDbContext _db;

            public ValidateTeamCodeHandler(AppDbContext db)
            {
                _db = db;
            }

            public async ValueTask<ValidateTeamCodeResponse?> Handle(
                ValidateTeamCodeQuery request,
                CancellationToken cancellationToken = default)
            {
                var normalizedCode = request.Code.Trim().ToUpper();
                var team = await _db.Teams
                    .AsNoTracking()
                    .FirstOrDefaultAsync(t => t.JoinCode == normalizedCode, cancellationToken);

                return team is null
                    ? null
                    : new ValidateTeamCodeResponse(team.Id, team.Name);
            }
        }

        public class Validator : AbstractValidator<ValidateTeamCodeQuery>
        {
            public Validator()
            {
                RuleFor(r => r.Code)
                    .NotEmpty()
                    .Length(ValidationConstants.TeamJoinCodeLength)
                    .Matches("^[A-Za-z0-9]{8}$")
                    .WithMessage("El código de equipo debe tener exactamente 8 caracteres alfanuméricos.");
            }
        }
    }
}
