using Azure.Storage.Blobs;
using FluentValidation;
using Hellang.Middleware.ProblemDetails;
using Jose;
using Mediator;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing.Template;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.Domain.Services;
using RFFM.Api.Features.Federation.Competitions.Services;
using RFFM.Api.Features.Federation.Players.Services;
using RFFM.Api.Features.Federation.Settings.Services;
using RFFM.Api.Features.Federation.Teams.Services;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Services.Email;
using System.IO;

namespace RFFM.Api.DependencyInjection
{
    public static class ServiceCollectionExtensions
    {
        public static IServiceCollection AddAppServices(this IServiceCollection services,
            IConfiguration configuration)
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

            // Email template service requires a template path; allow configuration override
            var templatePath = Path.Combine(Directory.GetParent(Directory.GetCurrentDirectory()).FullName,
                "RFFM.Api", "Infrastructure", "Services", "Email", "Templates");

            services.AddSingleton<EmailTemplateService>(provider => new EmailTemplateService(templatePath));


            services.AddScoped<EmailService>();
            services.AddScoped<IUserRegistrationEmailService, UserRegistrationEmailService>();

            // Register IdentityDbContext if a connection string is present
            var identityConn = configuration.GetConnectionString("IdentityConnection") ?? configuration.GetConnectionString("DefaultConnection");
            if (!string.IsNullOrWhiteSpace(identityConn))
            {
                services.AddDbContext<IdentityDbContext>(options =>
                    options.UseSqlServer(identityConn));
            }

            // Register AppDbContext using CatalogConnection (required)
            var catalogConn = configuration.GetConnectionString("CatalogConnection");
            if (string.IsNullOrWhiteSpace(catalogConn))
            {
                throw new InvalidOperationException("Connection string 'CatalogConnection' is required.");
            }

            services.AddDbContext<AppDbContext>(options =>
            {
                options.UseSqlServer(catalogConn, sqlServerOptions =>
                {
                    sqlServerOptions.EnableRetryOnFailure(
                        maxRetryCount: 5,
                        maxRetryDelay: TimeSpan.FromSeconds(30),
                        errorNumbersToAdd: null);

                    sqlServerOptions.CommandTimeout(60);
                });

                options.ConfigureWarnings(warnings => warnings.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning));
            });

            // Register other domain services
            services.AddScoped<IActaService, ActaService>();
            services.AddScoped<IPlayerService, PlayerService>();

            // Register Coaches PlayerService implementation and BlobServiceClient used by it
            var azureBlobConn = configuration.GetConnectionString("AzureBlobStorage") ?? configuration["AzureBlobStorage"];
            if (!string.IsNullOrWhiteSpace(azureBlobConn))
            {
                services.AddSingleton(sp => new BlobServiceClient(azureBlobConn));
                services.AddScoped<RFFM.Api.Features.Coaches.Players.Services.IPlayerService, RFFM.Api.Features.Coaches.Players.Services.PlayerService>();
            }

            services.AddScoped<ICompetitionService, CompetitionService>();
            services.AddScoped<ITeamService, TeamService>();
            services.AddScoped<ICalendarService, CalendarService>();
            services.AddScoped<IMatchDayService, MatchDayService>();
            services.AddScoped<IGoalMinuteParser, GoalMinuteParser>();
            services.AddScoped<ISectorFactory, SectorFactory>();
            services.AddScoped<IGoalSectorsAggregator, GoalSectorsAggregator>();
            services.AddScoped<IFederationSettingService, FederationSettingService>();
            services.AddMemoryCache();
            return services;
        }


        static IServiceCollection AddBehaviors(this IServiceCollection services)
        {
            return services
                .AddTransient(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>))
                .AddTransient(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>))
                .AddTransient(typeof(IPipelineBehavior<,>), typeof(TimeLoggingBehavior<,>))
                .AddTransient(typeof(IPipelineBehavior<,>), typeof(CachingBehavior<,>))
                .AddTransient(typeof(IPipelineBehavior<,>), typeof(InvalidateCachingBehavior<,>));
        }

        static IServiceCollection AddCustomProblemDetails(this IServiceCollection services)
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
                setup.Map<ValidationException>(exception =>
                    new StatusCodeProblemDetails(StatusCodes.Status400BadRequest)
                    {
                        Title = "Error de validación",
                        Detail = exception.Message
                    });
                
                setup.Map<ArgumentNullException>(exception =>
                    new StatusCodeProblemDetails(StatusCodes.Status400BadRequest)
                    {
                        Title = "Argumento requerido",
                        Detail = exception.Message
                    });
                
                // Errores HTTP
                setup.MapToStatusCode<NotImplementedException>(StatusCodes.Status501NotImplemented);
                setup.MapToStatusCode<HttpRequestException>(StatusCodes.Status503ServiceUnavailable);
                
                // Error genérico (último recurso)
                setup.MapToStatusCode<Exception>(StatusCodes.Status500InternalServerError);
            });
        }
    }
}