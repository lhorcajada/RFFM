using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.FeatureModules;

namespace RFFM.Api.Features.Coaches.Assistances.Queries
{
    public class GetAssistanceTypes : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/assistancetypes",
                    async (IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        return await mediator.Send(new AssistanceTypesQueryApp(), cancellationToken);
                    })
                .WithName(nameof(GetAssistanceTypes))
                .WithTags("AssistanceTypes")
                .RequireAuthorization()
                .Produces<AssistanceTypeResponse[]>();
        }

        public record AssistanceTypesQueryApp : Common.IQueryApp<AssistanceTypeResponse[]>;

        public record AssistanceTypeResponse(int Id, string Name, int Points);

        public class AssistanceTypesRequestHandler : IRequestHandler<AssistanceTypesQueryApp, AssistanceTypeResponse[]>
        {
            public ValueTask<AssistanceTypeResponse[]> Handle(AssistanceTypesQueryApp request, CancellationToken cancellationToken = default)
            {
                var items = AssistanceType.List()
                    .Select(at => new AssistanceTypeResponse(at.Id, at.Name, at.Points))
                    .ToArray();

                return ValueTask.FromResult(items);
            }
        }
    }
}
