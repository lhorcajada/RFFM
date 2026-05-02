using Mediator;
using Microsoft.EntityFrameworkCore;
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
    public class FeaturePermissionBehavior<TRequest, TResponse>
        : IPipelineBehavior<TRequest, TResponse>
        where TRequest : IRequest<TResponse>
    {
        private readonly ICurrentUserService _currentUser;
        private readonly AppDbContext _db;

        public FeaturePermissionBehavior(ICurrentUserService currentUser, AppDbContext db)
        {
            _currentUser = currentUser;
            _db = db;
        }

        public async ValueTask<TResponse> Handle(
            TRequest message,
            MessageHandlerDelegate<TRequest, TResponse> next,
            CancellationToken cancellationToken)
        {
            if (message is not IRequireFeaturePermission requirement)
                return await next(message, cancellationToken);

            if (!_currentUser.IsAuthenticated)
                throw new UnauthorizedAccessException("No autenticado.");

            var role = _currentUser.Role;
            if (string.IsNullOrEmpty(role))
                throw new UnauthorizedAccessException("No se pudo determinar el rol del usuario.");

            // Administrator bypasses all feature permission checks
            if (string.Equals(role, AppRoles.Administrator.Name, StringComparison.OrdinalIgnoreCase))
                return await next(message, cancellationToken);

            var permission = await _db.FeaturePermissions
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    fp => fp.RoleName == role && fp.FeatureRoute == requirement.FeatureRoute,
                    cancellationToken);

            if (permission == null)
                throw new UnauthorizedAccessException(
                    $"El rol '{role}' no tiene acceso a la funcionalidad '{requirement.FeatureRoute}'.");

            bool allowed = requirement.RequiredPermission switch
            {
                "Read" => permission.PermissionTypeId == PermissionType.Read.Id
                          || permission.PermissionTypeId == PermissionType.ReadWrite.Id,
                "Write" => permission.PermissionTypeId == PermissionType.Write.Id
                           || permission.PermissionTypeId == PermissionType.ReadWrite.Id,
                "ReadWrite" => permission.PermissionTypeId == PermissionType.ReadWrite.Id,
                _ => false
            };

            if (!allowed)
                throw new UnauthorizedAccessException(
                    $"El rol '{role}' solo tiene acceso de tipo '{PermissionType.FromId(permission.PermissionTypeId).Name}' " +
                    $"a '{requirement.FeatureRoute}', pero se requiere '{requirement.RequiredPermission}'.");

            return await next(message, cancellationToken);
        }
    }
}
