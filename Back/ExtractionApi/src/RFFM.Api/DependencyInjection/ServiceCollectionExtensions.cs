using Azure.Storage.Blobs;
using FluentValidation;
using Hellang.Middleware.ProblemDetails;
using Mediator;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing.Template;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.Domain.Services;
using RFFM.Api.Features.Federation.Competitions.Services;
using RFFM.Api.Features.Federation.Players.Services;
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

            // Domain / Infrastructure service registrations
            services.AddScoped<ITokenService, TokenService>();
            services.AddScoped<IInvitationService, InvitationService>();

            // Email template service requires a template path; allow configuration override
            var templatePath = Path.Combine(Directory.GetParent(Directory.GetCurrentDirectory()).FullName,
                "RFFM.Api", "Infrastructure", "Services", "Email", "Templates");

            services.AddSingleton<EmailTemplateService>(provider => new EmailTemplateService(templatePath));


            services.AddScoped<EmailService>();

            // Register IdentityDbContext if a connection string is present
            var identityConn = configuration.GetConnectionString("IdentityConnection") ?? configuration.GetConnectionString("DefaultConnection");
            if (!string.IsNullOrWhiteSpace(identityConn))
            {
                services.AddDbContext<IdentityDbContext>(options =>
                    options.UseSqlServer(identityConn));
            }

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
                setup.Map<RFFM.Api.Domain.DomainException>(exception =>
                    new StatusCodeProblemDetails(StatusCodes.Status400BadRequest)
                    {
                        Title = exception.Title,
                        Detail = exception.Description,
                        Extensions = { ["code"] = exception.Code }
                    });
                setup.Map<InvalidOperationException>(exception =>
                    new StatusCodeProblemDetails(StatusCodes.Status409Conflict)
                    {
                        Detail = exception.Message
                    });
                setup.Map<ValidationException>(exception =>
                    new StatusCodeProblemDetails(StatusCodes.Status409Conflict)
                    {
                        Detail = exception.Message
                    });
                setup.Map<Microsoft.IdentityModel.Tokens.SecurityTokenException>(exception =>
                    new StatusCodeProblemDetails(StatusCodes.Status401Unauthorized)
                    {
                        Detail = "Invalid or expired token"
                    });
                setup.MapToStatusCode<NotImplementedException>(StatusCodes.Status501NotImplemented);
                setup.MapToStatusCode<HttpRequestException>(StatusCodes.Status503ServiceUnavailable);
                setup.MapToStatusCode<Exception>(StatusCodes.Status500InternalServerError);
            });
        }
    }
}