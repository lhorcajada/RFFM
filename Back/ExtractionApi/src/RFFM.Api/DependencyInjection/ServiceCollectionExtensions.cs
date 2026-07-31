using RFFM.Api.Infrastructure.Storage;
using FluentValidation;
using Hellang.Middleware.ProblemDetails;
using Jose;
using Mediator;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing.Template;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.Domain.Services;
using RFFM.Api.Infrastructure.Services;
using RFFM.Api.Features.Federation.Competitions.Services;
using RFFM.Api.Features.Federation.Clubs.Services;
using RFFM.Api.Features.Federation.Players.Services;
using RFFM.Api.Features.Federation.Settings.Services;
using RFFM.Api.Features.Federation.Teams.Services;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Services.Email;
using RFFM.Api.Services.Export;
using System.IO;

namespace RFFM.Api.DependencyInjection
{
    public static class ServiceCollectionExtensions
    {
        public static IServiceCollection AddAppServices(this IServiceCollection services,
            IConfiguration configuration,
            IHostEnvironment environment)
        {
            services.AddControllers()
                .AddApplicationPart(typeof(App).Assembly);

            services.AddCustomProblemDetails()
                .AddMediator(o => { o.ServiceLifetime = ServiceLifetime.Scoped; });

            services.AddBehaviors()
             .AddEasyCaching(options => { options.UseInMemory(Cache.CacheDefaultName); });

            //services.AddIntegrationEvents();
            services.AddHttpClient();
            // Allow handlers to access HttpContext when needed
            services.AddHttpContextAccessor();

            // Domain / Infrastructure service registrations
            services.AddScoped<ITokenService, TokenService>();
            services.AddScoped<IInvitationService, InvitationService>();
            services.AddScoped<ICurrentUserService, CurrentUserService>();

            // FluentValidation validators for the News feature (explicit registration — no
            // assembly-wide validator scan exists in this project; ValidationBehavior resolves
            // IEnumerable<IValidator<TRequest>> from DI, so each validator must be registered).
            services.AddScoped<FluentValidation.IValidator<RFFM.Api.Features.Coaches.News.CreateNewsCommand>, RFFM.Api.Features.Coaches.News.CreateNewsValidator>();
            services.AddScoped<FluentValidation.IValidator<RFFM.Api.Features.Coaches.News.UpdateNewsCommand>, RFFM.Api.Features.Coaches.News.UpdateNewsValidator>();
            services.AddScoped<FluentValidation.IValidator<RFFM.Api.Features.Coaches.News.UploadNewsImageCommand>, RFFM.Api.Features.Coaches.News.UploadNewsImageValidator>();

            // FluentValidation validators for the PushNotifications feature (same manual
            // registration requirement as News above — no assembly-wide validator scan).
            services.AddScoped<FluentValidation.IValidator<RFFM.Api.Features.Mobile.PushNotifications.RegisterPushToken.RegisterPushTokenCommand>, RFFM.Api.Features.Mobile.PushNotifications.RegisterPushToken.Validator>();
            services.AddScoped<FluentValidation.IValidator<RFFM.Api.Features.Mobile.PushNotifications.UnregisterPushToken.UnregisterPushTokenCommand>, RFFM.Api.Features.Mobile.PushNotifications.UnregisterPushToken.Validator>();
            services.AddScoped<FluentValidation.IValidator<RFFM.Api.Features.Mobile.PushNotifications.UpdatePushPreferences.UpdatePushPreferencesCommand>, RFFM.Api.Features.Mobile.PushNotifications.UpdatePushPreferences.Validator>();

            // Email template service requires a template path; allow configuration override
            var templatePath = Path.Combine(Directory.GetParent(Directory.GetCurrentDirectory()).FullName,
                "RFFM.Api", "Infrastructure", "Services", "Email", "Templates");

            services.AddSingleton<EmailTemplateService>(provider => new EmailTemplateService(templatePath));


            services.AddScoped<EmailService>();
            services.AddScoped<IUserRegistrationEmailService, UserRegistrationEmailService>();

            // Single shared connection string for all DbContexts
            var futbolBaseConn = configuration.GetConnectionString("FutbolBaseConnection")
                ?? throw new InvalidOperationException("Connection string 'FutbolBaseConnection' is required.");

            services.AddDbContext<IdentityDbContext>(options =>
                options.UseNpgsql(futbolBaseConn, npgsqlOptions =>
                {
                    npgsqlOptions.EnableRetryOnFailure(
                        maxRetryCount: 5,
                        maxRetryDelay: TimeSpan.FromSeconds(30),
                        errorCodesToAdd: null);
                    npgsqlOptions.CommandTimeout(120);
                    npgsqlOptions.MigrationsHistoryTable("__EFMigrationsHistory", "identity");
                }));

            services.AddDbContext<AppDbContext>(options =>
            {
                options.UseNpgsql(futbolBaseConn, npgsqlOptions =>
                {
                    npgsqlOptions.EnableRetryOnFailure(
                        maxRetryCount: 5,
                        maxRetryDelay: TimeSpan.FromSeconds(30),
                        errorCodesToAdd: null);
                    npgsqlOptions.CommandTimeout(120);
                    npgsqlOptions.MigrationsHistoryTable("__EFMigrationsHistory", "app");
                });

                options.ConfigureWarnings(warnings => warnings.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning));
            });

            services.AddDbContext<FederationDbContext>(options =>
                options.UseNpgsql(futbolBaseConn, npgsqlOptions =>
                {
                    npgsqlOptions.EnableRetryOnFailure(
                        maxRetryCount: 5,
                        maxRetryDelay: TimeSpan.FromSeconds(30),
                        errorCodesToAdd: null);
                    npgsqlOptions.CommandTimeout(120);
                    npgsqlOptions.MigrationsHistoryTable("__EFMigrationsHistory", "federation");
                }));

            // Register other domain services
            services.AddScoped<IActaService, ActaService>();
            services.AddScoped<IPlayerService, PlayerService>();

            // Register Supabase client and storage service.
            // Development defaults to local filesystem; deployed environments default to Supabase.
            bool? useLocalStorage = configuration.GetSection("Storage").GetValue<bool?>("UseLocal");
            var useLocalStorageResolved = useLocalStorage ?? environment.IsDevelopment();
            var supabaseUrl = configuration["SupabaseStorage:Url"];
            var supabaseKey = configuration["SupabaseStorage:ServiceKey"];
            if (useLocalStorageResolved)
            {
                services.AddScoped<IStorageService, LocalStorageService>();
            }
            else if (!string.IsNullOrWhiteSpace(supabaseUrl) && !string.IsNullOrWhiteSpace(supabaseKey))
            {
                services.AddSingleton(new Supabase.Client(supabaseUrl, supabaseKey));
                services.AddScoped<IStorageService, SupabaseStorageService>();
            }
            else
            {
                throw new InvalidOperationException("Supabase storage is required outside local development. Set Storage:UseLocal=true for local runs or provide Supabase configuration.");
            }
            services.AddScoped<RFFM.Api.Features.Coaches.Players.Services.IPlayerService, RFFM.Api.Features.Coaches.Players.Services.PlayerService>();

            services.AddScoped<ICompetitionService, CompetitionService>();
            services.AddScoped<ITeamService, TeamService>();
            services.AddScoped<IClubDirectoryService, ClubDirectoryService>();
            services.AddScoped<ICalendarService, CalendarService>();
            services.AddHttpClient("ExpoPush", c => c.BaseAddress = new Uri("https://exp.host/"));
            services.AddScoped<RFFM.Api.Features.Mobile.PushNotifications.Services.IExpoPushService, RFFM.Api.Features.Mobile.PushNotifications.Services.ExpoPushService>();
            services.AddScoped<RFFM.Api.Features.Mobile.PushNotifications.IPushNotificationDispatcher, RFFM.Api.Features.Mobile.PushNotifications.PushNotificationDispatcher>();
            services.AddScoped<IMatchDayService, MatchDayService>();
            services.AddScoped<IGoalMinuteParser, GoalMinuteParser>();
            services.AddScoped<ISectorFactory, SectorFactory>();
            services.AddScoped<IGoalSectorsAggregator, GoalSectorsAggregator>();
            services.AddScoped<IFederationSettingService, FederationSettingService>();
            services.AddScoped<RFFM.Api.Features.Scopes.IScopeAuthorizationService, RFFM.Api.Features.Scopes.ScopeAuthorizationService>();
            services.AddScoped<RFFM.Api.Domain.Services.IClubSeatBillingService, RFFM.Api.Domain.Services.ClubSeatBillingService>();
            services.AddMemoryCache();
            // PDF generators
            services.AddSingleton<SeasonPrepPdfGenerator>();
            return services;
        }


        static IServiceCollection AddBehaviors(this IServiceCollection services)
        {
            return services
                .AddTransient(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>))
                .AddTransient(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>))
                .AddTransient(typeof(IPipelineBehavior<,>), typeof(TimeLoggingBehavior<,>))
                .AddTransient(typeof(IPipelineBehavior<,>), typeof(FeaturePermissionBehavior<,>))
                .AddTransient(typeof(IPipelineBehavior<,>), typeof(TeamMembershipBehavior<,>))
                .AddTransient(typeof(IPipelineBehavior<,>), typeof(CachingBehavior<,>))
                .AddTransient(typeof(IPipelineBehavior<,>), typeof(InvalidateCachingBehavior<,>));
        }

        internal static IServiceCollection AddCustomProblemDetails(this IServiceCollection services)
        {
            return services.AddProblemDetails(setup =>
            {
                // Errores de dominio (negocio)
                setup.Map<RFFM.Api.Domain.DomainException>(exception =>
                    new StatusCodeProblemDetails(StatusCodes.Status400BadRequest)
                    {
                        Title = exception.Title,
                        Detail = exception.Description,
                        Extensions = { ["code"] = exception.Code }
                    });
                
                // Errores de autenticación/autorización
                setup.Map<UnauthorizedAccessException>(exception =>
                    new StatusCodeProblemDetails(StatusCodes.Status401Unauthorized)
                    {
                        Title = "No autorizado",
                        Detail = exception.Message
                    });

                setup.Map<RFFM.Api.Domain.ForbiddenAccessException>(exception =>
                    new StatusCodeProblemDetails(StatusCodes.Status403Forbidden)
                    {
                        Title = "Acceso denegado",
                        Detail = exception.Message
                    });

                setup.Map<RFFM.Api.Domain.NotFoundException>(exception =>
                    new StatusCodeProblemDetails(StatusCodes.Status404NotFound)
                    {
                        Title = "No encontrado",
                        Detail = exception.Message,
                        Extensions = { ["code"] = exception.Code }
                    });

                setup.Map<RFFM.Api.Domain.ConflictException>(exception =>
                    new StatusCodeProblemDetails(StatusCodes.Status409Conflict)
                    {
                        Title = "Conflicto",
                        Detail = exception.Message,
                        Extensions = { ["code"] = exception.Code }
                    });

                setup.Map<SecurityTokenException>(exception =>
                    new StatusCodeProblemDetails(StatusCodes.Status401Unauthorized)
                    {
                        Title = "Token inválido",
                        Detail = exception.Message
                    });
                
                setup.Map<SecurityTokenInvalidSignatureException>(exception =>
                    new StatusCodeProblemDetails(StatusCodes.Status401Unauthorized)
                    {
                        Title = "Firma de token inválida",
                        Detail = "La firma del token no es válida"
                    });
                
                // Errores de Jose-JWT
                setup.Map<IntegrityException>(exception =>
                    new StatusCodeProblemDetails(StatusCodes.Status401Unauthorized)
                    {
                        Title = "Firma de token inválida",
                        Detail = "La firma del token JWT no es válida"
                    });
                
                setup.Map<InvalidAlgorithmException>(exception =>
                    new StatusCodeProblemDetails(StatusCodes.Status401Unauthorized)
                    {
                        Title = "Algoritmo de token inválido",
                        Detail = "El algoritmo del token JWT no es el esperado (HS256)"
                    });
                
                // Errores de configuración
                setup.Map<InvalidOperationException>(exception =>
                    new StatusCodeProblemDetails(StatusCodes.Status500InternalServerError)
                    {
                        Title = "Error de configuración",
                        Detail = exception.Message
                    });
                
                // Errores de validación
                // NOTA: ValidationBehavior.cs lanza System.ComponentModel.DataAnnotations.ValidationException
                // (no FluentValidation.ValidationException, aunque este archivo tiene "using FluentValidation;").
                // Hay que calificar el tipo completo aquí para que el mapping realmente se dispare;
                // de lo contrario cae en el catch-all Exception -> 500.
                setup.Map<System.ComponentModel.DataAnnotations.ValidationException>(exception =>
                    new StatusCodeProblemDetails(StatusCodes.Status400BadRequest)
                    {
                        Title = "Error de validación",
                        Detail = exception.Message,
                        Extensions =
                        {
                            ["code"] = RFFM.Api.Domain.ErrorCodes.ValidationFailed,
                            ["errors"] = ParseValidationErrors(exception.Message)
                        }
                    });

                setup.Map<ArgumentNullException>(exception =>
                    new StatusCodeProblemDetails(StatusCodes.Status400BadRequest)
                    {
                        Title = "Argumento requerido",
                        Detail = exception.Message,
                        Extensions = { ["code"] = RFFM.Api.Domain.ErrorCodes.MissingRequiredArgument }
                    });
                
                // Errores HTTP
                setup.MapToStatusCode<NotImplementedException>(StatusCodes.Status501NotImplemented);
                setup.MapToStatusCode<HttpRequestException>(StatusCodes.Status503ServiceUnavailable);
                
                // Error genérico (último recurso)
                setup.MapToStatusCode<Exception>(StatusCodes.Status500InternalServerError);
            });
        }

        /// <summary>
        /// Parses the "Property1: Message1; Property2: Message2" string built by
        /// ValidationBehavior into a structured list so the frontend can, if it wants,
        /// highlight the specific field without needing a code-per-rule catalog.
        /// </summary>
        internal static IReadOnlyList<ValidationFieldError> ParseValidationErrors(string errorMessage)
        {
            if (string.IsNullOrWhiteSpace(errorMessage))
            {
                return Array.Empty<ValidationFieldError>();
            }

            return errorMessage
                .Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(entry =>
                {
                    var separatorIndex = entry.IndexOf(':');
                    return separatorIndex < 0
                        ? new ValidationFieldError(string.Empty, entry.Trim())
                        : new ValidationFieldError(
                            entry[..separatorIndex].Trim(),
                            entry[(separatorIndex + 1)..].Trim());
                })
                .ToArray();
        }
    }

    public record ValidationFieldError(string Field, string Message);
}