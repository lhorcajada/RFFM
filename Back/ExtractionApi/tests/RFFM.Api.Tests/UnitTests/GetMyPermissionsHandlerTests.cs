#nullable enable
using Moq;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Services;
using RFFM.Api.Features.Coaches.Permissions;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class GetMyPermissionsHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GetMyPermissionsHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        [Fact]
        public async Task Handle_UserWithMultipleRoles_ReturnsFeaturePermissionsFromAllRoles()
        {
            // Regression test: a user with roles ["Federacion-xxx", "Coach-xxx"] must receive
            // the FeaturePermission seeded for "Coach-xxx" (e.g. "/coach/settings"), even though
            // that role is not the first one in the user's roles collection.
            await using var db = _fixture.CreateDbContext();
            var primaryRoleWithoutAccess = $"Federacion-{Guid.NewGuid():N}";
            var secondaryRoleWithAccess = $"Coach-{Guid.NewGuid():N}";
            db.FeaturePermissions.Add(new FeaturePermission(
                "Settings", "/coach/settings", secondaryRoleWithAccess, PermissionType.Read, true));
            await db.SaveChangesAsync();

            var currentUser = new Mock<ICurrentUserService>();
            currentUser.Setup(c => c.IsAuthenticated).Returns(true);
            currentUser.Setup(c => c.Role).Returns(primaryRoleWithoutAccess);
            currentUser.Setup(c => c.Roles).Returns(new[] { primaryRoleWithoutAccess, secondaryRoleWithAccess });

            var handler = new GetMyPermissions.GetMyPermissionsHandler(db, currentUser.Object);

            var result = await handler.Handle(
                new GetMyPermissions.GetMyPermissionsQuery("user-id"),
                CancellationToken.None);

            Assert.Contains(secondaryRoleWithAccess, result.Roles);
            Assert.Contains(primaryRoleWithoutAccess, result.Roles);
            Assert.Contains(result.FeaturePermissions, fp => fp.FeatureRoute == "/coach/settings");
        }

        [Fact]
        public async Task Handle_UserWithSingleRole_ReturnsOnlyThatRolesPermissions()
        {
            await using var db = _fixture.CreateDbContext();
            var role = $"Coach-{Guid.NewGuid():N}";
            var otherRole = $"Federacion-{Guid.NewGuid():N}";
            db.FeaturePermissions.Add(new FeaturePermission(
                "Settings", "/coach/settings", role, PermissionType.Read, true));
            db.FeaturePermissions.Add(new FeaturePermission(
                "OtherFeature", "/federacion/other", otherRole, PermissionType.Read, true));
            await db.SaveChangesAsync();

            var currentUser = new Mock<ICurrentUserService>();
            currentUser.Setup(c => c.IsAuthenticated).Returns(true);
            currentUser.Setup(c => c.Role).Returns(role);
            currentUser.Setup(c => c.Roles).Returns(new[] { role });

            var handler = new GetMyPermissions.GetMyPermissionsHandler(db, currentUser.Object);

            var result = await handler.Handle(
                new GetMyPermissions.GetMyPermissionsQuery("user-id"),
                CancellationToken.None);

            Assert.Single(result.Roles);
            Assert.Contains(result.FeaturePermissions, fp => fp.FeatureRoute == "/coach/settings");
            Assert.DoesNotContain(result.FeaturePermissions, fp => fp.FeatureRoute == "/federacion/other");
        }
    }
}
