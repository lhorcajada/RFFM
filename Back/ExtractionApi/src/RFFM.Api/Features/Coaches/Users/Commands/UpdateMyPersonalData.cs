using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.Users.Queries;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Users.Commands
{
    /// <summary>
    /// Crea o actualiza los datos personales del usuario autenticado.
    /// PUT /api/users/me/personal-data
    /// </summary>
    public class UpdateMyPersonalData : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("api/users/me/personal-data",
                    async (Command command, IMediator mediator, HttpContext httpContext, CancellationToken ct) =>
                    {
                        var userId = CurrentUser.GetId(httpContext.User);
                        if (string.IsNullOrEmpty(userId))
                            return Results.Unauthorized();

                        return Results.Ok(await mediator.Send(command with { UserId = userId }, ct));
                    })
                .WithName(nameof(UpdateMyPersonalData))
                .WithTags(UserConstants.UserFeature)
                .Produces<GetMyAccount.MyAccountResponse>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .RequireAuthorization();
        }

        public record Command : IRequest<GetMyAccount.MyAccountResponse>
        {
            public string UserId { get; init; } = string.Empty;
            public string FirstName { get; init; } = string.Empty;
            public string LastName { get; init; } = string.Empty;
            public string? SecondLastName { get; init; }
            public string? PhoneNumber { get; init; }
        }

        public class Validator : AbstractValidator<Command>
        {
            private const string PhonePattern = @"^\+?[0-9 ]{9,20}$";

            public Validator()
            {
                RuleFor(x => x.FirstName).NotEmpty().MaximumLength(UserPersonalData.Rules.NameMaxLength);
                RuleFor(x => x.LastName).NotEmpty().MaximumLength(UserPersonalData.Rules.NameMaxLength);
                RuleFor(x => x.SecondLastName).MaximumLength(UserPersonalData.Rules.NameMaxLength);
                RuleFor(x => x.PhoneNumber)
                    .Matches(PhonePattern)
                    .When(x => !string.IsNullOrWhiteSpace(x.PhoneNumber));
            }
        }

        public class Handler(AppDbContext db, UserManager<IdentityUser> userManager)
            : IRequestHandler<Command, GetMyAccount.MyAccountResponse>
        {
            public async ValueTask<GetMyAccount.MyAccountResponse> Handle(Command request, CancellationToken cancellationToken)
            {
                var user = await userManager.FindByIdAsync(request.UserId)
                           ?? throw new NotFoundException("Usuario no encontrado", ErrorCodes.UserNotFound);

                var data = await db.UserPersonalData
                    .FirstOrDefaultAsync(p => p.ApplicationUserId == request.UserId, cancellationToken);

                if (data is null)
                {
                    data = UserPersonalData.Create(request.UserId, request.FirstName, request.LastName,
                        request.SecondLastName, request.PhoneNumber);
                    db.UserPersonalData.Add(data);
                }
                else
                {
                    data.Update(request.FirstName, request.LastName, request.SecondLastName, request.PhoneNumber);
                }

                await db.SaveChangesAsync(cancellationToken);

                return GetMyAccount.MyAccountResponse.From(user, data);
            }
        }
    }
}
