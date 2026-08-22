using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.Invitation;
using RFFM.Api.Features.Coaches.Players.Queries;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Services.Email;
using System.Security.Claims;

namespace RFFM.Api.Features.Coaches.Users.Commands
{
    public class CreateUser : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("api/register", async (Command command, IMediator mediator, CancellationToken cancellationToken)
                    => await mediator.Send(command, cancellationToken))
                .WithName(nameof(CreateUser))
                .WithTags(UserConstants.UserFeature)
                .Produces<RegisterAccountResponse>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict)
                .AllowAnonymous();
        }

        public class Command : IInvalidateCacheRequest, IRequest<IResult>
        {
            public string Alias { get; set; } = null!;
            public string Email { get; set; } = null!;
            public string Password { get; set; } = null!;
            public string AccountType { get; set; } = null!;

            public bool? TrialAccepted { get; set; }
            public string? ClubInvitationCode { get; set; }
            public string? TeamInvitationCode { get; set; }
            public string? TeamPlayerId { get; set; }
            public string? PlayerLinkCode { get; set; }

            public string PrefixCacheKey => UserConstants.CachePrefix;
        }

        public class Handler : IRequestHandler<Command, IResult>
        {
            private readonly UserManager<IdentityUser> _userManager;
            private readonly RoleManager<IdentityRole> _roleManager;
            private readonly EmailService _emailService;
            private readonly IConfiguration _configuration;
            private readonly AppDbContext _db;
            private readonly ILogger<Handler> _logger;

            public Handler(UserManager<IdentityUser> userManager,
                          RoleManager<IdentityRole> roleManager,
                          EmailService emailService,
                          IConfiguration configuration,
                          AppDbContext db,
                          ILogger<Handler> logger)
            {
                _userManager = userManager;
                _roleManager = roleManager;
                _emailService = emailService;
                _configuration = configuration;
                _db = db;
                _logger = logger;
            }

            public async ValueTask<IResult> Handle(Command request, CancellationToken cancellationToken)
            {
                var accountType = (request.AccountType ?? string.Empty).Trim();

                // Validate accountType early
                if (string.IsNullOrEmpty(accountType) || !AppRoles.List().Any(r => string.Equals(r.Name, accountType, StringComparison.OrdinalIgnoreCase)))
                {
                    return Results.BadRequest(new ProblemDetails
                    {
                        Title = "Tipo de cuenta requerido",
                        Detail = "Debe seleccionar un tipo de cuenta válido.",
                        Extensions = { ["code"] = ErrorCodes.AccountTypeRequired }
                    });
                }

                // 1. Duplicate alias/email checks (UNCHANGED from today — keep these first).
                var existsAlias = await _userManager.FindByNameAsync(request.Alias);
                if (existsAlias != null)
                {
                    return Results.Conflict(new ProblemDetails
                    {
                        Status = StatusCodes.Status409Conflict,
                        Title = "Alias duplicado",
                        Detail = $"Ya existe un usuario con el alias: {request.Alias}",
                        Extensions = { ["code"] = ErrorCodes.AliasIsAlreadyTaken }
                    });
                }

                var existsEmail = await _userManager.FindByEmailAsync(request.Email);
                if (existsEmail != null)
                {
                    return Results.BadRequest(new ProblemDetails
                    {
                        Title = "Email ya registrado",
                        Detail = $"Ya existe una cuenta con el email: {request.Email}",
                        Extensions = { ["code"] = ErrorCodes.EmailIsAlreadyTaken }
                    });
                }

                // 2. Pre-checks BEFORE any Identity/DB write — resolve club/team/roster
                //    and fail fast with the right status code.
                Club? club = null;
                Team? team = null;
                TeamRosterQueries.RosterPlayer[]? roster = null;
                Membership? membership = null;
                bool playerLinkCodeMatched = false;

                if (IsClubDirector(accountType))
                {
                    if (request.TrialAccepted != true) return TrialRequiredResult();
                    membership = null; // no Membership row for a club director (not a club/team member concept)
                }
                else if (IsCoach(accountType))
                {
                    if (string.IsNullOrWhiteSpace(request.ClubInvitationCode))
                    {
                        if (request.TrialAccepted != true) return TrialRequiredResult();
                    }
                    else
                    {
                        var validation = await ClubInvitationValidation.Validate(_db, request.ClubInvitationCode, Membership.Coach, cancellationToken);
                        if (!validation.Success) return ProblemFrom(validation.StatusCode, validation.Title, validation.Detail, validation.ErrorCode);
                        club = validation.Club; membership = Membership.Coach;
                    }
                }
                else if (IsClubMember(accountType))
                {
                    var validation = await ClubInvitationValidation.Validate(_db, request.ClubInvitationCode, Membership.ClubMember, cancellationToken);
                    if (!validation.Success) return ProblemFrom(validation.StatusCode, validation.Title, validation.Detail, validation.ErrorCode);
                    club = validation.Club; membership = Membership.ClubMember;
                }
                else if (IsPlayer(accountType) || IsFamilyMember(accountType))
                {
                    var wantedMembership = IsPlayer(accountType) ? Membership.Player : Membership.FamilyPlayer;
                    var validation = await TeamInvitationValidation.Validate(_db, request.TeamInvitationCode, wantedMembership, cancellationToken);
                    if (!validation.Success) return ProblemFrom(validation.StatusCode, validation.Title, validation.Detail, validation.ErrorCode);
                    team = validation.Team; membership = wantedMembership;

                    var rosterMembershipId = wantedMembership.Key == Membership.Player.Key ? Membership.Player.Id : (int?)null;
                    roster = await TeamRosterQueries.GetRoster(_db, team!.Id, rosterMembershipId, cancellationToken);
                    var chosen = roster.FirstOrDefault(p => p.TeamPlayerId == request.TeamPlayerId);
                    if (chosen is null)
                    {
                        return Results.BadRequest(new ProblemDetails
                        {
                            Title = "Jugador no pertenece al equipo",
                            Detail = "El jugador seleccionado no está en el roster del equipo.",
                            Extensions = { ["code"] = ErrorCodes.LinkedPlayerNotInTeam }
                        });
                    }
                    if (wantedMembership.Key == Membership.Player.Key && chosen.AlreadyLinked)
                    {
                        return Results.Conflict(new ProblemDetails
                        {
                            Status = StatusCodes.Status409Conflict,
                            Title = "Jugador ya vinculado",
                            Detail = "Este jugador ya tiene una cuenta de tipo Player vinculada.",
                            Extensions = { ["code"] = ErrorCodes.LinkedPlayerAlreadyClaimed }
                        });
                    }

                    if (wantedMembership.Key == Membership.Player.Key)
                    {
                        var alreadyPending = await _db.TeamPlayerLinkRequests.AsNoTracking().AnyAsync(r =>
                            r.TeamPlayerId == request.TeamPlayerId
                            && r.MembershipId == Membership.Player.Id
                            && r.Status == TeamPlayerLinkRequestStatus.Pending, cancellationToken);
                        if (alreadyPending)
                        {
                            return Results.Conflict(new ProblemDetails
                            {
                                Status = StatusCodes.Status409Conflict,
                                Title = "Solicitud ya en curso",
                                Detail = "Ya hay una solicitud pendiente para vincularse a este jugador.",
                                Extensions = { ["code"] = ErrorCodes.LinkedPlayerRequestPending }
                            });
                        }
                    }

                    if (!string.IsNullOrWhiteSpace(request.PlayerLinkCode))
                    {
                        var normalizedPlayerCode = request.PlayerLinkCode.Trim().ToUpperInvariant();
                        var teamPlayerEntity = await _db.TeamPlayers.AsNoTracking()
                            .FirstOrDefaultAsync(tp => tp.Id == request.TeamPlayerId, cancellationToken);
                        if (teamPlayerEntity?.LinkCode is null || teamPlayerEntity.LinkCode.ToUpperInvariant() != normalizedPlayerCode)
                        {
                            return Results.BadRequest(new ProblemDetails
                            {
                                Title = "Código de jugador inválido",
                                Detail = "El código introducido no corresponde a este jugador.",
                                Extensions = { ["code"] = ErrorCodes.PlayerLinkCodeInvalid }
                            });
                        }
                        playerLinkCodeMatched = true;
                    }
                }
                // Fan: no pre-checks.

                // 3. Create the Identity user, then persist the club/team/join-request row.
                //
                //    NOTE on atomicity: Identity (IdentityUser/roles) lives in a separate
                //    DbContext/connection (IdentityDbContext) from the club/team rows
                //    (AppDbContext). Npgsql does not support promoting a
                //    System.Transactions.TransactionScope spanning two independent connections
                //    into a real distributed (two-phase-commit) transaction, and — independently
                //    of that — an ambient/explicit TransactionScope is fundamentally incompatible
                //    with AppDbContext's EnableRetryOnFailure execution strategy (EF Core throws
                //    "The configured execution strategy ... does not support user-initiated
                //    transactions" as soon as any command runs under one). The previous
                //    TransactionScope here therefore never gave genuine cross-DbContext atomicity
                //    (see design.md's own "Cross-DbContext transaction" risk note) and, once
                //    retry-on-failure was enabled the same way in production and in tests, made
                //    every registration fail with HTTP 500.
                //
                //    The fix: use EF Core's execution-strategy-aware transaction API
                //    (CreateExecutionStrategy + BeginTransactionAsync/CommitAsync) to keep the
                //    AppDbContext writes (club/team/join-request row + SaveChangesAsync) atomic
                //    and retry-safe on their own. Identity role assignment stays a best-effort,
                //    swallow-and-log step outside that transaction (as it already was for 3 of 4
                //    branches via EnsureIdentityRoleAsync) since it was never truly part of the
                //    same atomic unit to begin with.
                var user = new IdentityUser { Email = request.Email, UserName = request.Alias };
                var createResult = await _userManager.CreateAsync(user, request.Password);
                if (!createResult.Succeeded)
                {
                    return Results.BadRequest(new ProblemDetails
                    {
                        Title = "No se pudo crear el usuario",
                        Detail = string.Join("; ", createResult.Errors.Select(e => e.Description)),
                        Extensions = { ["code"] = ErrorCodes.UserCreationFailed }
                    });
                }

                var identityRoleName = accountType; // AppRoles names match AccountType strings 1:1 (validated above)
                ClubJoinRequest? pendingJoinRequest = null;
                TeamPlayerLinkRequest? pendingLinkRequest = null;

                var strategy = _db.Database.CreateExecutionStrategy();
                await strategy.ExecuteAsync(async () =>
                {
                    // Retries re-run this whole delegate, so make sure it starts from a clean
                    // change-tracker state each attempt instead of re-adding entities tracked by
                    // a previous (failed) attempt.
                    _db.ChangeTracker.Clear();

                    await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

                    if (IsCoach(accountType) && !string.IsNullOrWhiteSpace(request.ClubInvitationCode))
                    {
                        // Pending path: create ClubJoinRequest, NO UserClub, NO Identity role yet.
                        pendingJoinRequest = ClubJoinRequest.Create(user.Id, club!.Id, Membership.Coach.Id);
                        _db.ClubJoinRequests.Add(pendingJoinRequest);
                    }
                    else if (club is not null && membership is not null) // ClubMember
                    {
                        _db.UserClubs.Add(new UserClub(user.Id, club.Id, membership.Id));
                    }
                    else if (team is not null && membership is not null && playerLinkCodeMatched) // Player/FamilyMember con código correcto
                    {
                        var userTeam = new UserTeam(user.Id, team.Id, membership.Id);
                        userTeam.LinkPlayer(request.TeamPlayerId!);
                        _db.UserTeams.Add(userTeam);
                    }
                    else if (team is not null && membership is not null) // Player/FamilyMember sin código válido -> pendiente
                    {
                        pendingLinkRequest = TeamPlayerLinkRequest.Create(user.Id, team.Id, request.TeamPlayerId!, membership.Id);
                        _db.TeamPlayerLinkRequests.Add(pendingLinkRequest);
                    }

                    await _db.SaveChangesAsync(cancellationToken);
                    await transaction.CommitAsync(cancellationToken);
                });

                if (pendingJoinRequest is null && pendingLinkRequest is null)
                {
                    await EnsureIdentityRoleAsync(user, identityRoleName);
                }

                // 4. Best-effort, non-security side effects OUTSIDE the transaction (unchanged pattern).
                if (team is not null && pendingLinkRequest is null && (IsPlayer(accountType) || IsFamilyMember(accountType)))
                {
                    await SaveUserProfileAsync(user.Id, identityRoleName, request.TeamPlayerId!, team.Id, cancellationToken);
                }

                Subscription? subscription = null;
                var grantsTrial = IsClubDirector(accountType) || (IsCoach(accountType) && string.IsNullOrWhiteSpace(request.ClubInvitationCode));
                if (grantsTrial)
                {
                    subscription = await CreateFreeTrialSubscriptionAsync(user.Id, cancellationToken);
                }

                await SendConfirmationEmailAsync(user, cancellationToken); // unchanged admin-moderation email

                if (pendingJoinRequest is not null)
                {
                    await NotifyClubCreatorOfPendingRequestAsync(pendingJoinRequest, cancellationToken); // best-effort
                }

                if (pendingLinkRequest is not null)
                {
                    await NotifyTeamCreatorOfPendingLinkRequestAsync(pendingLinkRequest, cancellationToken);
                }

                var roles = await _userManager.GetRolesAsync(user);

                return Results.Ok(new RegisterAccountResponse
                {
                    UserId = user.Id,
                    Roles = roles.ToArray(),
                    Status = pendingJoinRequest is not null
                        ? RegistrationStatus.PendingClubApproval
                        : pendingLinkRequest is not null
                            ? RegistrationStatus.PendingPlayerLinkApproval
                            : RegistrationStatus.Active,
                    Subscription = subscription is null ? null : new SubscriptionDto
                    {
                        Plan = "Free",
                        Status = subscription.Status.ToString(),
                        EndDate = subscription.EndDate
                    },
                    ClubJoinRequestId = pendingJoinRequest?.Id,
                    TeamPlayerLinkRequestId = pendingLinkRequest?.Id
                });
            }

            private IResult TrialRequiredResult()
            {
                return Results.BadRequest(new ProblemDetails
                {
                    Title = "Aceptación de prueba requerida",
                    Detail = "Debe aceptar la prueba de 7 días para continuar.",
                    Extensions = { ["code"] = ErrorCodes.TrialAcceptanceRequired }
                });
            }

            private IResult ProblemFrom(int? statusCode, string? title, string? detail, string? code)
            {
                return (statusCode ?? 400) switch
                {
                    404 => Results.NotFound(new ProblemDetails
                    {
                        Status = 404,
                        Title = title,
                        Detail = detail,
                        Extensions = { ["code"] = code }
                    }),
                    409 => Results.Conflict(new ProblemDetails
                    {
                        Status = StatusCodes.Status409Conflict,
                        Title = title,
                        Detail = detail,
                        Extensions = { ["code"] = code }
                    }),
                    _ => Results.BadRequest(new ProblemDetails
                    {
                        Title = title,
                        Detail = detail,
                        Extensions = { ["code"] = code }
                    })
                };
            }

            private async Task EnsureIdentityRoleAsync(IdentityUser user, string roleName)
            {
                try
                {
                    if (!await _roleManager.RoleExistsAsync(roleName))
                    {
                        await _roleManager.CreateAsync(new IdentityRole(roleName));
                    }
                    await _userManager.AddToRoleAsync(user, roleName);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "CreateUser: could not assign Identity role {Role} to user {UserId}",
                        roleName, user.Id);
                }
            }

            private async Task NotifyClubCreatorOfPendingRequestAsync(ClubJoinRequest joinRequest, CancellationToken cancellationToken)
            {
                try
                {
                    var creator = await _db.UserClubs
                        .AsNoTracking()
                        .Where(uc => uc.ClubId == joinRequest.ClubId && uc.IsCreator)
                        .Select(uc => uc.ApplicationUserId)
                        .FirstOrDefaultAsync(cancellationToken);

                    if (string.IsNullOrEmpty(creator))
                        return;

                    var creatorUser = await _userManager.FindByIdAsync(creator);
                    if (creatorUser?.Email == null)
                        return;

                    var applicant = await _userManager.FindByIdAsync(joinRequest.ApplicationUserId);
                    var club = await _db.Clubs.AsNoTracking().FirstOrDefaultAsync(c => c.Id == joinRequest.ClubId, cancellationToken);

                    if (applicant == null || club == null)
                        return;

                    var placeholders = new Dictionary<string, string>
                    {
                        ["DirectorName"] = creatorUser.UserName ?? string.Empty,
                        ["ApplicantAlias"] = applicant.UserName ?? string.Empty,
                        ["ClubName"] = club.Name
                    };

                    var subject = "Nueva solicitud de entrenador - Futbol Base";
                    await _emailService.SendEmailAsync(creatorUser.Email, subject, "ClubJoinRequestReceivedTemplate", placeholders);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "CreateUser: could not send club join request notification for request {RequestId}", joinRequest.Id);
                }
            }

            private async Task NotifyTeamCreatorOfPendingLinkRequestAsync(TeamPlayerLinkRequest linkRequest, CancellationToken cancellationToken)
            {
                try
                {
                    var creator = await _db.UserTeams
                        .AsNoTracking()
                        .Where(ut => ut.TeamId == linkRequest.TeamId && ut.IsCreator)
                        .Select(ut => ut.ApplicationUserId)
                        .FirstOrDefaultAsync(cancellationToken);

                    if (string.IsNullOrEmpty(creator))
                    {
                        var team = await _db.Teams.AsNoTracking().FirstOrDefaultAsync(t => t.Id == linkRequest.TeamId, cancellationToken);
                        if (team is not null)
                        {
                            creator = await _db.UserClubs
                                .AsNoTracking()
                                .Where(uc => uc.ClubId == team.ClubId && uc.IsCreator)
                                .Select(uc => uc.ApplicationUserId)
                                .FirstOrDefaultAsync(cancellationToken);
                        }
                    }

                    if (string.IsNullOrEmpty(creator)) return;

                    var creatorUser = await _userManager.FindByIdAsync(creator);
                    if (creatorUser?.Email == null) return;

                    var applicant = await _userManager.FindByIdAsync(linkRequest.ApplicationUserId);
                    var teamPlayer = await _db.TeamPlayers.AsNoTracking()
                        .Include(tp => tp.Player)
                        .FirstOrDefaultAsync(tp => tp.Id == linkRequest.TeamPlayerId, cancellationToken);

                    if (applicant == null || teamPlayer == null) return;

                    var placeholders = new Dictionary<string, string>
                    {
                        ["CoachName"] = creatorUser.UserName ?? string.Empty,
                        ["ApplicantAlias"] = applicant.UserName ?? string.Empty,
                        ["PlayerName"] = $"{teamPlayer.Player.Name} {teamPlayer.Player.LastName}".Trim()
                    };

                    var subject = "Nueva solicitud de vinculación a jugador - Futbol Base";
                    await _emailService.SendEmailAsync(creatorUser.Email, subject, "TeamPlayerLinkRequestReceivedTemplate", placeholders);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "CreateUser: could not send team player link request notification for request {RequestId}", linkRequest.Id);
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
                    _logger.LogWarning(ex, "CreateUser: could not save UserProfile for user {UserId}", userId);
                }
            }

            private async Task<Subscription?> CreateFreeTrialSubscriptionAsync(string userId, CancellationToken cancellationToken)
            {
                try
                {
                    var freePlan = await _db.PaymentPlans!.FirstOrDefaultAsync(p => p.Name == "Free", cancellationToken);
                    if (freePlan == null)
                    {
                        freePlan = new PaymentPlan
                        {
                            Name = "Free",
                            Description = "7 days free trial",
                            PriceCents = 0,
                            BillingPeriod = BillingPeriodType.OneOff,
                            AllowedClubs = 1,
                            AllowedTeams = 1,
                            AllowedUsers = 1
                        };
                        _db.PaymentPlans!.Add(freePlan);
                        await _db.SaveChangesAsync(cancellationToken);
                    }

                    var now = DateTime.UtcNow;
                    var sub = new Subscription
                    {
                        UserId = userId,
                        PaymentPlanId = freePlan.Id,
                        StartDate = now,
                        EndDate = now.AddDays(7),
                        Status = SubscriptionStatus.Active,
                        CreatedAt = now
                    };
                    _db.Subscriptions!.Add(sub);
                    await _db.SaveChangesAsync(cancellationToken);
                    return sub;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "CreateUser: error persisting Subscription for user {UserId}", userId);
                    return null;
                }
            }

            private async Task SendConfirmationEmailAsync(IdentityUser user, CancellationToken cancellationToken)
            {
                try
                {
                    var token = await _userManager.GenerateEmailConfirmationTokenAsync(user);
                    var apiBase = _configuration["ApiBase"]?.TrimEnd('/')
                                  ?? _configuration["FrontUrlBase"]?.TrimEnd('/')
                                  ?? string.Empty;
                    var confirmUrl = !string.IsNullOrEmpty(apiBase)
                        ? $"{apiBase}/api/users/confirm?userId={user.Id}&token={Uri.EscapeDataString(token)}"
                        : $"/api/users/confirm?userId={user.Id}&token={Uri.EscapeDataString(token)}";

                    var placeholders = new Dictionary<string, string>
                    {
                        ["UserName"] = user.UserName ?? string.Empty,
                        ["ConfirmUrl"] = confirmUrl,
                        ["UserEmail"] = user.Email ?? string.Empty
                    };

                    var subject = "Aprobación de nuevo usuario - Futbol Base";
                    var adminEmail = _configuration["Smtp:FromEmail"] ?? _configuration["Seed:AdminEmail"] ?? string.Empty;
                    if (string.IsNullOrWhiteSpace(adminEmail))
                    {
                        return;
                    }

                    await _emailService.SendEmailAsync(adminEmail, subject, "ConfirmUserTemplate", placeholders);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "CreateUser: could not send confirmation email for user {UserId}", user.Id);
                }
            }

            private static bool IsClubDirector(string? t) => string.Equals(t, AppRoles.ClubDirector.Name, StringComparison.OrdinalIgnoreCase);
            private static bool IsCoach(string? t) => string.Equals(t, AppRoles.Coach.Name, StringComparison.OrdinalIgnoreCase);
            private static bool IsClubMember(string? t) => string.Equals(t, AppRoles.ClubMember.Name, StringComparison.OrdinalIgnoreCase);
            private static bool IsPlayer(string? t) => string.Equals(t, AppRoles.Player.Name, StringComparison.OrdinalIgnoreCase);
            private static bool IsFamilyMember(string? t) => string.Equals(t, AppRoles.FamilyMember.Name, StringComparison.OrdinalIgnoreCase);
        }

        public class Validator : AbstractValidator<Command>
        {
            public Validator()
            {
                RuleFor(r => r.Alias).NotEmpty();
                RuleFor(r => r.Email).NotEmpty().EmailAddress();
                RuleFor(r => r.Password).NotEmpty();
                RuleFor(r => r.AccountType).NotEmpty()
                    .Must(BeAKnownSelfRegisterableRole)
                    .WithMessage("Tipo de cuenta desconocido o no auto-registrable.");

                When(r => IsClubDirector(r.AccountType) ||
                          (IsCoach(r.AccountType) && string.IsNullOrWhiteSpace(r.ClubInvitationCode)), () =>
                {
                    RuleFor(r => r.TrialAccepted).Equal(true)
                        .WithMessage("Debes aceptar la prueba de 7 días.");
                });

                When(r => (IsCoach(r.AccountType) && !string.IsNullOrWhiteSpace(r.ClubInvitationCode)) ||
                          IsClubMember(r.AccountType), () =>
                {
                    RuleFor(r => r.ClubInvitationCode).NotEmpty();
                });

                When(r => IsPlayer(r.AccountType) || IsFamilyMember(r.AccountType), () =>
                {
                    RuleFor(r => r.TeamInvitationCode).NotEmpty();
                    RuleFor(r => r.TeamPlayerId).NotEmpty();
                });
            }

            private static bool BeAKnownSelfRegisterableRole(string? accountType)
            {
                if (string.IsNullOrWhiteSpace(accountType)) return false;
                if (string.Equals(accountType, AppRoles.Administrator.Name, StringComparison.OrdinalIgnoreCase)) return false;
                if (string.Equals(accountType, AppRoles.Federation.Name, StringComparison.OrdinalIgnoreCase)) return false;
                return AppRoles.List().Any(r => string.Equals(r.Name, accountType, StringComparison.OrdinalIgnoreCase));
            }

            private static bool IsClubDirector(string? t) => string.Equals(t, AppRoles.ClubDirector.Name, StringComparison.OrdinalIgnoreCase);
            private static bool IsCoach(string? t) => string.Equals(t, AppRoles.Coach.Name, StringComparison.OrdinalIgnoreCase);
            private static bool IsClubMember(string? t) => string.Equals(t, AppRoles.ClubMember.Name, StringComparison.OrdinalIgnoreCase);
            private static bool IsPlayer(string? t) => string.Equals(t, AppRoles.Player.Name, StringComparison.OrdinalIgnoreCase);
            private static bool IsFamilyMember(string? t) => string.Equals(t, AppRoles.FamilyMember.Name, StringComparison.OrdinalIgnoreCase);
        }
    }

    public enum RegistrationStatus { Active, PendingClubApproval, PendingPlayerLinkApproval }

    public class RegisterAccountResponse
    {
        public string UserId { get; set; } = string.Empty;
        public string[] Roles { get; set; } = Array.Empty<string>();
        public RegistrationStatus Status { get; set; }
        public SubscriptionDto? Subscription { get; set; }
        public string? ClubJoinRequestId { get; set; }
        public string? TeamPlayerLinkRequestId { get; set; }
    }

    public class SubscriptionDto
    {
        public string Plan { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public DateTime EndDate { get; set; }
    }
}
