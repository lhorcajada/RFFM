using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Scopes;
using RFFM.Api.Infrastructure.Persistence;
using System.Globalization;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace RFFM.Api.Features.Coaches.FamilyMemberAccounts.Commands
{
    public class RegisterFamilyMemberAccount : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("api/family-members/{familyMemberId}/register",
                    async (string familyMemberId, IMediator mediator, HttpContext httpContext, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                                     ?? httpContext.User.FindFirst("sub")?.Value;
                        if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

                        return await mediator.Send(new RegisterFamilyMemberAccountCommand
                        {
                            FamilyMemberId = familyMemberId,
                            CallerUserId = userId
                        }, cancellationToken);
                    })
                .WithName(nameof(RegisterFamilyMemberAccount))
                .WithTags("FamilyMemberAccountsFeature")
                .RequireAuthorization()
                .Produces<RegisterFamilyMemberAccountResponse>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict);
        }
    }

    public class RegisterFamilyMemberAccountCommand : IRequest<IResult>, IRequireFeaturePermission
    {
        public string FamilyMemberId { get; set; } = string.Empty;
        public string CallerUserId { get; set; } = string.Empty;

        public string FeatureRoute => CoachFeatureRoutes.Squad;
        public string RequiredPermission => "ReadWrite";

        public class Handler : IRequestHandler<RegisterFamilyMemberAccountCommand, IResult>
        {
            private readonly UserManager<IdentityUser> _userManager;
            private readonly RoleManager<IdentityRole> _roleManager;
            private readonly AppDbContext _db;
            private readonly IScopeAuthorizationService _scopeAuth;
            private readonly ILogger<Handler> _logger;

            public Handler(
                UserManager<IdentityUser> userManager,
                RoleManager<IdentityRole> roleManager,
                AppDbContext db,
                IScopeAuthorizationService scopeAuth,
                ILogger<Handler> logger)
            {
                _userManager = userManager;
                _roleManager = roleManager;
                _db = db;
                _scopeAuth = scopeAuth;
                _logger = logger;
            }

            public async ValueTask<IResult> Handle(RegisterFamilyMemberAccountCommand request, CancellationToken cancellationToken)
            {
                // 1. Load family member with team player
                var familyMember = await _db.TeamPlayerFamilyMembers
                    .Include(f => f.TeamPlayer).ThenInclude(tp => tp.Player)
                    .FirstOrDefaultAsync(f => f.Id == request.FamilyMemberId, cancellationToken);

                if (familyMember is null)
                {
                    return Results.NotFound(new ProblemDetails
                    {
                        Title = "Familiar no encontrado",
                        Detail = "El familiar indicado no existe.",
                        Extensions = { ["code"] = ErrorCodes.FamilyMemberNotFound }
                    });
                }

                // 2. Check authorization
                var auth = await _scopeAuth.EnsureCreatorAsync(request.CallerUserId, ScopeKinds.Team, familyMember.TeamPlayer.TeamId, cancellationToken);
                if (!auth.Authorized)
                {
                    return Results.Problem(statusCode: auth.Status, title: auth.Title, detail: auth.Detail);
                }

                // 3. Validate email
                if (string.IsNullOrWhiteSpace(familyMember.Email))
                {
                    return Results.BadRequest(new ProblemDetails
                    {
                        Title = "Email requerido",
                        Detail = "El familiar debe tener un email para registrarse.",
                        Extensions = { ["code"] = ErrorCodes.FamilyMemberEmailRequired }
                    });
                }

                // 4. Check if already linked
                if (familyMember.LinkedUserId is not null)
                {
                    return Results.Conflict(new ProblemDetails
                    {
                        Status = StatusCodes.Status409Conflict,
                        Title = "Familiar ya vinculado",
                        Detail = "Este familiar ya tiene una cuenta asociada.",
                        Extensions = { ["code"] = ErrorCodes.FamilyMemberAccountAlreadyLinked }
                    });
                }

                // 5. Check if pending request already exists
                var existingPending = await _db.FamilyMemberAccountRequests
                    .FirstOrDefaultAsync(r => r.TeamPlayerFamilyMemberId == familyMember.Id
                        && r.Status == FamilyMemberAccountRequestStatus.Pending, cancellationToken);
                if (existingPending is not null)
                {
                    return Results.Conflict(new ProblemDetails
                    {
                        Status = StatusCodes.Status409Conflict,
                        Title = "Solicitud pendiente",
                        Detail = "Ya existe una solicitud de registro pendiente para este familiar.",
                        Extensions = { ["code"] = ErrorCodes.FamilyMemberAccountRequestAlreadyPending }
                    });
                }

                // 6. Generate alias
                var baseAlias = GenerateBaseAlias(familyMember.Name, familyMember.LastName);
                var alias = await FindAvailableAlias(baseAlias, cancellationToken);

                // 7. Generate password
                var password = GeneratePassword(familyMember.TeamPlayer.Player.Name);

                // 8. Create Identity user
                var user = new IdentityUser { Email = familyMember.Email, UserName = alias };
                var createResult = await _userManager.CreateAsync(user, password);
                if (!createResult.Succeeded)
                {
                    return Results.BadRequest(new ProblemDetails
                    {
                        Title = "No se pudo crear el usuario",
                        Detail = string.Join("; ", createResult.Errors.Select(e => e.Description)),
                        Extensions = { ["code"] = ErrorCodes.UserCreationFailed }
                    });
                }

                // 9. Create request in transaction
                string requestId = string.Empty;
                var strategy = _db.Database.CreateExecutionStrategy();
                await strategy.ExecuteAsync(async () =>
                {
                    _db.ChangeTracker.Clear();
                    await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

                    var request_obj = FamilyMemberAccountRequest.Create(user.Id, familyMember.Id, familyMember.TeamPlayer.Id);
                    _db.FamilyMemberAccountRequests.Add(request_obj);
                    await _db.SaveChangesAsync(cancellationToken);
                    await transaction.CommitAsync(cancellationToken);
                    requestId = request_obj.Id;
                });

                // 10. Return response
                var familyMemberName = $"{familyMember.Name} {familyMember.LastName}".Trim();
                var playerName = familyMember.TeamPlayer.Player.Name;

                return Results.Ok(new RegisterFamilyMemberAccountResponse
                {
                    RequestId = requestId,
                    Alias = alias,
                    Password = password,
                    FamilyMemberName = familyMemberName,
                    PlayerName = playerName,
                    Status = "Pending"
                });
            }

            private string GenerateBaseAlias(string? name, string? lastName)
            {
                var combined = $"{name ?? ""} {lastName ?? ""}".Trim();
                if (string.IsNullOrWhiteSpace(combined))
                    return "familiar";

                // Normalize diacritics and convert to lowercase
                var normalized = RemoveDiacritics(combined).ToLowerInvariant();
                // Keep only alphanumeric characters
                var slug = Regex.Replace(normalized, @"[^a-z0-9]", "");

                return string.IsNullOrWhiteSpace(slug) ? "familiar" : slug;
            }

            private string RemoveDiacritics(string text)
            {
                var normalizedString = text.Normalize(NormalizationForm.FormD);
                var stringBuilder = new System.Text.StringBuilder();

                foreach (var c in normalizedString)
                {
                    var unicodeCategory = CharUnicodeInfo.GetUnicodeCategory(c);
                    if (unicodeCategory != UnicodeCategory.NonSpacingMark)
                    {
                        stringBuilder.Append(c);
                    }
                }

                return stringBuilder.ToString().Normalize(NormalizationForm.FormC);
            }

            private async Task<string> FindAvailableAlias(string baseAlias, CancellationToken cancellationToken)
            {
                var candidate = baseAlias;
                var counter = 2;

                while (await _userManager.FindByNameAsync(candidate) is not null)
                {
                    candidate = $"{baseAlias}{counter}";
                    counter++;
                }

                return candidate;
            }

            private string GeneratePassword(string? playerFirstName)
            {
                // Get first name word, title-cased
                var nameWord = "Familia";
                if (!string.IsNullOrWhiteSpace(playerFirstName))
                {
                    var parts = playerFirstName.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                    if (parts.Length > 0 && parts[0].Any(c => char.IsLetter(c)))
                    {
                        nameWord = char.ToUpperInvariant(parts[0][0]) + parts[0][1..].ToLowerInvariant();
                    }
                }

                // Generate 4 random digits
                var randomDigits = RandomNumberGenerator.GetInt32(0, 10000).ToString("D4");

                return $"{nameWord}{randomDigits}!";
            }
        }

        public class Validator : AbstractValidator<RegisterFamilyMemberAccountCommand>
        {
            public Validator()
            {
                RuleFor(x => x.FamilyMemberId).NotEmpty();
                RuleFor(x => x.CallerUserId).NotEmpty();
            }
        }
    }

    public class RegisterFamilyMemberAccountResponse
    {
        public string RequestId { get; set; } = string.Empty;
        public string Alias { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string FamilyMemberName { get; set; } = string.Empty;
        public string PlayerName { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
    }
}
