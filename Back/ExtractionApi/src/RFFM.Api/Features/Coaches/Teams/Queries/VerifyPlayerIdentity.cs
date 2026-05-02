using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using System.Globalization;
using System.Security.Claims;
using System.Text;

namespace RFFM.Api.Features.Coaches.Teams.Queries
{
    public class VerifyPlayerIdentity : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/catalog/team/{teamId}/verify-player",
                    async (string teamId, [FromBody] VerifyPlayerRequest body, IMediator mediator,
                           HttpContext httpContext, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                                     ?? httpContext.User.FindFirst("sub")?.Value;

                        var query = new VerifyPlayerQuery(teamId, body.Name, body.LastName, body.BirthDate, userId);
                        var result = await mediator.Send(query, cancellationToken);
                        return result is null
                            ? Results.NotFound()
                            : Results.Ok(result);
                    })
                .WithName(nameof(VerifyPlayerIdentity))
                .WithTags(TeamConstants.TeamFeature)
                .Produces<VerifyPlayerResponse>()
                .Produces(StatusCodes.Status404NotFound)
                .RequireAuthorization();
        }

        public record VerifyPlayerRequest(string Name, string? LastName, DateOnly BirthDate);

        public record VerifyPlayerQuery(string TeamId, string Name, string? LastName, DateOnly BirthDate, string? UserId)
            : IRequest<VerifyPlayerResponse?>;

        public record VerifyPlayerResponse(string PlayerId, string TeamId, string TeamName, string[]? Roles = null, string? Token = null);

        public class Handler : IRequestHandler<VerifyPlayerQuery, VerifyPlayerResponse?>
        {
            private readonly AppDbContext _db;
            private readonly UserManager<IdentityUser> _userManager;
            private readonly RoleManager<IdentityRole> _roleManager;
            private readonly ITokenService _tokenService;
            private readonly ILogger<Handler> _logger;

            public Handler(AppDbContext db, UserManager<IdentityUser> userManager,
                           RoleManager<IdentityRole> roleManager, ITokenService tokenService,
                           ILogger<Handler> logger)
            {
                _db = db;
                _userManager = userManager;
                _roleManager = roleManager;
                _tokenService = tokenService;
                _logger = logger;
            }

            public async ValueTask<VerifyPlayerResponse?> Handle(
                VerifyPlayerQuery request,
                CancellationToken cancellationToken = default)
            {
                var team = await _db.Teams
                    .AsNoTracking()
                    .FirstOrDefaultAsync(t => t.Id == request.TeamId, cancellationToken);

                if (team is null) return null;

                var players = await _db.TeamPlayers
                    .AsNoTracking()
                    .Include(tp => tp.Player)
                    .Where(tp => tp.TeamId == request.TeamId)
                    .Select(tp => new
                    {
                        tp.Player.Id,
                        tp.Player.Name,
                        tp.Player.LastName,
                        tp.Player.BirthDate
                    })
                    .ToListAsync(cancellationToken);

                var inputName = NormalizeText(request.Name);
                var inputLastName = NormalizeText(request.LastName);

                var match = players.FirstOrDefault(p =>
                    NormalizeText(p.Name) == inputName &&
                    NormalizeText(p.LastName) == inputLastName &&
                    p.BirthDate.HasValue &&
                    DateOnly.FromDateTime(p.BirthDate.Value.AddHours(12).Date) == request.BirthDate);

                if (match is null) return null;

                // Assign role + save profile if user is authenticated
                string[]? roles = null;
                string? jwt = null;
                if (!string.IsNullOrEmpty(request.UserId))
                {
                    var user = await _userManager.FindByIdAsync(request.UserId);
                    if (user is not null)
                    {
                        await EnsureRoleAssignedAsync(user, AppRoles.Player.Name, cancellationToken);
                        await SaveUserProfileAsync(request.UserId, AppRoles.Player.Name, match.Id, team.Id, cancellationToken);
                        roles = (await _userManager.GetRolesAsync(user)).ToArray();
                        jwt = await TryGenerateJwtAsync(request.UserId, cancellationToken);
                    }
                }

                return new VerifyPlayerResponse(match.Id, team.Id, team.Name, roles, jwt);
            }

            private async Task EnsureRoleAssignedAsync(IdentityUser user, string roleName, CancellationToken ct)
            {
                try
                {
                    if (!await _roleManager.RoleExistsAsync(roleName))
                        await _roleManager.CreateAsync(new IdentityRole(roleName));

                    if (!await _userManager.IsInRoleAsync(user, roleName))
                        await _userManager.AddToRoleAsync(user, roleName);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "VerifyPlayerIdentity: could not assign role {Role} to user {UserId}", roleName, user.Id);
                }
            }

            private async Task SaveUserProfileAsync(string userId, string roleName, string playerId, string teamId, CancellationToken ct)
            {
                try
                {
                    var existing = await _db.UserProfiles
                        .FirstOrDefaultAsync(p => p.ApplicationUserId == userId, ct);

                    if (existing is null)
                    {
                        _db.UserProfiles.Add(new UserProfile(userId, roleName, playerId, teamId));
                    }
                    else
                    {
                        existing.Update(roleName, playerId, teamId);
                    }

                    await _db.SaveChangesAsync(ct);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "VerifyPlayerIdentity: could not save UserProfile for user {UserId}", userId);
                }
            }

            private async Task<string?> TryGenerateJwtAsync(string userId, CancellationToken ct)
            {
                try
                {
                    return await _tokenService.GenerateJwtForUser(userId, ct);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "VerifyPlayerIdentity: could not generate JWT for user {UserId}", userId);
                    return null;
                }
            }

            private static string NormalizeText(string? s)
            {
                if (string.IsNullOrWhiteSpace(s)) return string.Empty;
                var decomposed = s.Normalize(NormalizationForm.FormD);
                var sb = new StringBuilder(decomposed.Length);
                foreach (var c in decomposed)
                {
                    var category = CharUnicodeInfo.GetUnicodeCategory(c);
                    if (category == UnicodeCategory.NonSpacingMark) continue;
                    if (char.IsLetter(c))
                        sb.Append(char.ToLowerInvariant(c));
                    else if (char.IsWhiteSpace(c) || c == '-')
                        sb.Append(' ');
                }
                return string.Join(' ', sb.ToString().Split(' ', StringSplitOptions.RemoveEmptyEntries));
            }
        }

        public class Validator : AbstractValidator<VerifyPlayerQuery>
        {
            public Validator()
            {
                RuleFor(r => r.TeamId).NotEmpty();
                RuleFor(r => r.Name).NotEmpty().MaximumLength(ValidationConstants.PlayerNameMaxLength);
                RuleFor(r => r.LastName).MaximumLength(ValidationConstants.PlayerLastNameMaxLength);
                RuleFor(r => r.BirthDate)
                    .Must(d => d <= DateOnly.FromDateTime(DateTime.Today))
                    .WithMessage("La fecha de nacimiento no puede ser futura.");
            }
        }
    }
}
