using FluentValidation;
using Hellang.Middleware.ProblemDetails;
using Mediator;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.Features.Players.Services;
using RFFM.Api.Features.Competitions.Services;
using RFFM.Api.Features.Teams.Services;

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
            services.AddScoped<IActaService, ActaService>();
            services.AddScoped<IPlayerService, PlayerService>();
            services.AddScoped<ICompetitionService, CompetitionService>();
            services.AddScoped<ITeamService, TeamService>();
            services.AddScoped<ICalendarService, CalendarService>();
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
                setup.MapToStatusCode<NotImplementedException>(StatusCodes.Status501NotImplemented);
                setup.MapToStatusCode<HttpRequestException>(StatusCodes.Status503ServiceUnavailable);
                setup.MapToStatusCode<Exception>(StatusCodes.Status500InternalServerError);
            });
        }
    }
}