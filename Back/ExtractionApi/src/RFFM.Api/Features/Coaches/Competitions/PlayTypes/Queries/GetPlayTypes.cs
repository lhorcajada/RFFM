using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.FeatureModules;

namespace RFFM.Api.Features.Coaches.Competitions.PlayTypes.Queries
{
    public class GetPlayTypes : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/playtypes",
                    async (IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        return await mediator.Send(new PlayTypesQueryApp(), cancellationToken);
                    })
                .WithName(nameof(GetPlayTypes))
                .WithTags(PlayTypesConstants.PlayTypesFeature)
                .Produces<PlayTypesResponse[]>();
        }

        public record PlayTypesQueryApp : Common.IQueryApp<PlayTypesResponse[]>;

        public record PlayTypesResponse(int Id, string Name);

        public class PlayTypesRequestHandler : IRequestHandler<PlayTypesQueryApp, PlayTypesResponse[]>
        {
            public ValueTask<PlayTypesResponse[]> Handle(PlayTypesQueryApp request, CancellationToken cancellationToken = default)
            {
                var playTypes = PlayType.GetAll()
                    .Select(pt => new PlayTypesResponse(pt.Id, pt.Name))
                    .ToArray();

                return ValueTask.FromResult(playTypes);
            }
        }
    }
}