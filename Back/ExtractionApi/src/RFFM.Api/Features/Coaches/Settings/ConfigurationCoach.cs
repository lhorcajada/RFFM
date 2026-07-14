using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using Mediator;

namespace RFFM.Api.Features.Coaches.Settings
{
    public class ConfigurationCoachModule : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/coaches/configuration", async (IMediator mediator, CancellationToken ct) =>
            {
                return Results.Ok(await mediator.Send(new GetConfigQuery(), ct));
            }).WithName("GetCoachConfiguration").WithTags("Coaches").RequireAuthorization();

            app.MapPost("/api/coaches/configuration", async (ConfigRequest req, IMediator mediator, CancellationToken ct) =>
            {
                return Results.Ok(await mediator.Send(new CreateConfigCommand(req), ct));
            }).WithName("CreateCoachConfiguration").WithTags("Coaches").RequireAuthorization();

            app.MapPut("/api/coaches/configuration/{id}", async (int id, ConfigRequest req, IMediator mediator, CancellationToken ct) =>
            {
                return Results.Ok(await mediator.Send(new UpdateConfigCommand(id, req), ct));
            }).WithName("UpdateCoachConfiguration").WithTags("Coaches").RequireAuthorization();

            app.MapDelete("/api/coaches/configuration/{id}", async (int id, IMediator mediator, CancellationToken ct) =>
            {
                return Results.Ok(await mediator.Send(new DeleteConfigCommand(id), ct));
            }).WithName("DeleteCoachConfiguration").WithTags("Coaches").RequireAuthorization();
        }

        public record ConfigDto(int Id, string CoachId, string? PreferredClubId, string? PreferredTeamId);
        public record ConfigRequest(string CoachId, string? PreferredClubId, string? PreferredTeamId);

        public record GetConfigQuery : RFFM.Api.Common.IQueryApp<ConfigDto[]>, IRequireFeaturePermission
        {
            public string FeatureRoute => CoachFeatureRoutes.Settings;
            public string RequiredPermission => "Read";
        }

        public class GetConfigHandler : IRequestHandler<GetConfigQuery, ConfigDto[]>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;

            public GetConfigHandler(AppDbContext db, ICurrentUserService currentUser)
            {
                _db = db;
                _currentUser = currentUser;
            }

            public async ValueTask<ConfigDto[]> Handle(GetConfigQuery request, CancellationToken cancellationToken = default)
            {
                var userId = _currentUser.UserId ?? string.Empty;
                var items = await _db.Set<RFFM.Api.Domain.Entities.Coaches.ConfigurationCoach>()
                    .AsNoTracking()
                    .Where(c => c.CoachId == userId)
                    .ToListAsync(cancellationToken);
                return items.Select(i => new ConfigDto(i.Id, i.CoachId, i.PreferredClubId, i.PreferredTeamId)).ToArray();
            }
        }

        public record CreateConfigCommand(ConfigRequest Request) : RFFM.Api.Common.ICommand<ConfigDto>, IRequireFeaturePermission
        {
            public string FeatureRoute => CoachFeatureRoutes.Settings;
            public string RequiredPermission => "ReadWrite";
        }
        public class CreateConfigHandler : IRequestHandler<CreateConfigCommand, ConfigDto>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;

            public CreateConfigHandler(AppDbContext db, ICurrentUserService currentUser)
            {
                _db = db;
                _currentUser = currentUser;
            }

            public async ValueTask<ConfigDto> Handle(CreateConfigCommand request, CancellationToken cancellationToken = default)
            {
                var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException();
                var entity = new RFFM.Api.Domain.Entities.Coaches.ConfigurationCoach
                {
                    CoachId = userId,
                    PreferredClubId = request.Request.PreferredClubId,
                    PreferredTeamId = request.Request.PreferredTeamId
                };
                _db.Add(entity);
                await _db.SaveChangesAsync(cancellationToken);
                return new ConfigDto(entity.Id, entity.CoachId, entity.PreferredClubId, entity.PreferredTeamId);
            }
        }

        public record UpdateConfigCommand(int Id, ConfigRequest Request) : RFFM.Api.Common.ICommand<ConfigDto>, IRequireFeaturePermission
        {
            public string FeatureRoute => CoachFeatureRoutes.Settings;
            public string RequiredPermission => "ReadWrite";
        }
        public class UpdateConfigHandler : IRequestHandler<UpdateConfigCommand, ConfigDto>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;

            public UpdateConfigHandler(AppDbContext db, ICurrentUserService currentUser)
            {
                _db = db;
                _currentUser = currentUser;
            }

            public async ValueTask<ConfigDto> Handle(UpdateConfigCommand request, CancellationToken cancellationToken = default)
            {
                var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException();
                var entity = await _db.Set<RFFM.Api.Domain.Entities.Coaches.ConfigurationCoach>().FirstOrDefaultAsync(c => c.Id == request.Id, cancellationToken);
                if (entity == null) throw new KeyNotFoundException();
                if (entity.CoachId != userId) throw new ForbiddenAccessException("No puedes modificar la configuración de otro entrenador.");

                entity.PreferredClubId = request.Request.PreferredClubId;
                entity.PreferredTeamId = request.Request.PreferredTeamId;
                await _db.SaveChangesAsync(cancellationToken);
                return new ConfigDto(entity.Id, entity.CoachId, entity.PreferredClubId, entity.PreferredTeamId);
            }
        }

        public record DeleteConfigCommand(int Id) : RFFM.Api.Common.ICommand<ConfigDto>, IRequireFeaturePermission
        {
            public string FeatureRoute => CoachFeatureRoutes.Settings;
            public string RequiredPermission => "ReadWrite";
        }
        public class DeleteConfigHandler : IRequestHandler<DeleteConfigCommand, ConfigDto>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;

            public DeleteConfigHandler(AppDbContext db, ICurrentUserService currentUser)
            {
                _db = db;
                _currentUser = currentUser;
            }

            public async ValueTask<ConfigDto> Handle(DeleteConfigCommand request, CancellationToken cancellationToken = default)
            {
                var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException();
                var entity = await _db.Set<RFFM.Api.Domain.Entities.Coaches.ConfigurationCoach>().FirstOrDefaultAsync(c => c.Id == request.Id, cancellationToken);
                if (entity == null) throw new KeyNotFoundException($"Configuration '{request.Id}' not found");
                if (entity.CoachId != userId) throw new ForbiddenAccessException("No puedes eliminar la configuración de otro entrenador.");

                _db.Remove(entity);
                await _db.SaveChangesAsync(cancellationToken);
                return new ConfigDto(entity.Id, entity.CoachId, entity.PreferredClubId, entity.PreferredTeamId);
            }
        }
    }
}
