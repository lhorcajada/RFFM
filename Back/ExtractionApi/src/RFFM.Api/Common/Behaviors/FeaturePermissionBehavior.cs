using Mediator;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Services;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Common.Behaviors
{
    /// <summary>
    /// Pipeline behavior that enforces feature-level permissions.
    /// If the incoming request implements <see cref="IRequireFeaturePermission"/>,
    /// it checks the <see cref="AppDbContext.FeaturePermissions"/> table for the
    /// current user's role before proceeding.
    /// </summary>
    public class FeaturePermissionBehavior<TRequest, TResponse>(ICurrentUserService currentUser, AppDbContext db)
        : IPipelineBehavior<TRequest, TResponse>
        where TRequest : IRequest<TResponse>
    {
        private readonly ICurrentUserService _currentUser = currentUser;
        private readonly AppDbContext _db = db;

        public async ValueTask<TResponse> Handle(
            TRequest message,
            MessageHandlerDelegate<TRequest, TResponse> next,
            CancellationToken cancellationToken)
        {
            if (message is not IRequireFeaturePermission requirement)
                return await next(message, cancellationToken);

            if (!_currentUser.IsAuthenticated)
                throw new UnauthorizedAccessException("No autenticado.");

            var roles = (_currentUser.Roles ?? [])
                .Where(r => !string.IsNullOrEmpty(r))
                .Distinct()
                .ToArray();
            if (roles.Length == 0)
                throw new UnauthorizedAccessException("No se pudo determinar el rol del usuario.");

            // Administrator bypasses all feature permission checks
            if (roles.Any(r => string.Equals(r, AppRoles.Administrator.Name, StringComparison.OrdinalIgnoreCase)))
                return await next(message, cancellationToken);

            var permissions = await _db.FeaturePermissions
                .AsNoTracking()
                .Where(fp => fp.FeatureRoute == requirement.FeatureRoute && roles.Contains(fp.RoleName))
                .ToListAsync(cancellationToken);

            if (permissions.Count == 0)
                throw new ForbiddenAccessException(
                    $"Ninguno de los roles del usuario ('{string.Join(", ", roles)}') tiene acceso a la funcionalidad '{requirement.FeatureRoute}'.");

            bool AllowsRequirement(FeaturePermission permission) => requirement.RequiredPermission switch
            {
                "Read" => permission.PermissionTypeId == PermissionType.Read.Id
                          || permission.PermissionTypeId == PermissionType.ReadWrite.Id,
                "Write" => permission.PermissionTypeId == PermissionType.Write.Id
                           || permission.PermissionTypeId == PermissionType.ReadWrite.Id,
                "ReadWrite" => permission.PermissionTypeId == PermissionType.ReadWrite.Id,
                _ => false
            };

            if (!permissions.Any(AllowsRequirement))
            {
                var grantedTypes = string.Join(", ", permissions.Select(p => PermissionType.FromId(p.PermissionTypeId).Name));
                throw new ForbiddenAccessException(
                    $"Los roles del usuario ('{string.Join(", ", roles)}') solo tienen acceso de tipo '{grantedTypes}' " +
                    $"a '{requirement.FeatureRoute}', pero se requiere '{requirement.RequiredPermission}'.");
            }

            return await next(message, cancellationToken);
        }
    }
}
