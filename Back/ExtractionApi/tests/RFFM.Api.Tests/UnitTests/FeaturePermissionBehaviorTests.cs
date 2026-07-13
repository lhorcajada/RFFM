#nullable enable
using Mediator;
using Moq;
using RFFM.Api.Common;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Services;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class FeaturePermissionBehaviorTests
    {
        private readonly PostgresContainerFixture _fixture;

        public FeaturePermissionBehaviorTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        public record TestRequest : IRequest<Unit>, IRequireFeaturePermission
        {
            public string FeatureRoute => "/coach/clubs";
            public string RequiredPermission => "Write";
        }

        private static ValueTask<Unit> Next(TestRequest r, CancellationToken ct) => ValueTask.FromResult(Unit.Value);

        [Fact]
        public async Task Handle_NotAuthenticated_ThrowsUnauthorizedAccessException()
        {
            await using var db = _fixture.CreateDbContext();
            var currentUser = new Mock<ICurrentUserService>();
            currentUser.Setup(c => c.IsAuthenticated).Returns(false);

            var behavior = new FeaturePermissionBehavior<TestRequest, Unit>(currentUser.Object, db);

            await Assert.ThrowsAsync<UnauthorizedAccessException>(
                async () => await behavior.Handle(new TestRequest(), Next, CancellationToken.None));
        }

        [Fact]
        public async Task Handle_AuthenticatedNoFeaturePermissionRow_ThrowsForbiddenAccessException()
        {
            await using var db = _fixture.CreateDbContext();
            var currentUser = new Mock<ICurrentUserService>();
            currentUser.Setup(c => c.IsAuthenticated).Returns(true);
            currentUser.Setup(c => c.Role).Returns($"Coach-{Guid.NewGuid():N}"); // rol único, sin fila seed

            var behavior = new FeaturePermissionBehavior<TestRequest, Unit>(currentUser.Object, db);

            await Assert.ThrowsAsync<ForbiddenAccessException>(
                async () => await behavior.Handle(new TestRequest(), Next, CancellationToken.None));
        }

        [Fact]
        public async Task Handle_InsufficientPermissionType_ThrowsForbiddenAccessException()
        {
            await using var db = _fixture.CreateDbContext();
            var role = $"RoleReadOnly-{Guid.NewGuid():N}";
            db.FeaturePermissions.Add(new FeaturePermission("ClubManagement", "/coach/clubs", role, PermissionType.Read, true));
            await db.SaveChangesAsync();

            var currentUser = new Mock<ICurrentUserService>();
            currentUser.Setup(c => c.IsAuthenticated).Returns(true);
            currentUser.Setup(c => c.Role).Returns(role);

            var behavior = new FeaturePermissionBehavior<TestRequest, Unit>(currentUser.Object, db);

            await Assert.ThrowsAsync<ForbiddenAccessException>(
                async () => await behavior.Handle(new TestRequest(), Next, CancellationToken.None));
        }

        [Fact]
        public async Task Handle_SufficientReadWritePermission_CallsNext()
        {
            await using var db = _fixture.CreateDbContext();
            var role = $"RoleReadWrite-{Guid.NewGuid():N}";
            db.FeaturePermissions.Add(new FeaturePermission("ClubManagement", "/coach/clubs", role, PermissionType.ReadWrite, true));
            await db.SaveChangesAsync();

            var currentUser = new Mock<ICurrentUserService>();
            currentUser.Setup(c => c.IsAuthenticated).Returns(true);
            currentUser.Setup(c => c.Role).Returns(role);

            var behavior = new FeaturePermissionBehavior<TestRequest, Unit>(currentUser.Object, db);
            var result = await behavior.Handle(new TestRequest(), Next, CancellationToken.None);

            Assert.Equal(Unit.Value, result);
        }

        [Fact]
        public async Task Handle_CoachRoleWithSeededWritePermission_CallsNext()
        {
            // Mirrors the seed row added to SeedFeaturePermissionsAsync
            // ("ClubManagement", "/coach/clubs", "Coach", PermissionType.Write, false) so a Coach
            // user (previously blocked with 403 by commit f3e776b) can create/update/delete clubs.
            await using var db = _fixture.CreateDbContext();
            const string role = "Coach";
            if (!db.FeaturePermissions.Any(fp => fp.RoleName == role && fp.FeatureRoute == "/coach/clubs"))
            {
                db.FeaturePermissions.Add(new FeaturePermission("ClubManagement", "/coach/clubs", role, PermissionType.Write, false));
                await db.SaveChangesAsync();
            }

            var currentUser = new Mock<ICurrentUserService>();
            currentUser.Setup(c => c.IsAuthenticated).Returns(true);
            currentUser.Setup(c => c.Role).Returns(role);

            var behavior = new FeaturePermissionBehavior<TestRequest, Unit>(currentUser.Object, db);
            var result = await behavior.Handle(new TestRequest(), Next, CancellationToken.None);

            Assert.Equal(Unit.Value, result);
        }

        [Fact]
        public async Task Handle_AdministratorRole_BypassesEvenWithoutFeaturePermissionRow()
        {
            await using var db = _fixture.CreateDbContext();
            var currentUser = new Mock<ICurrentUserService>();
            currentUser.Setup(c => c.IsAuthenticated).Returns(true);
            currentUser.Setup(c => c.Role).Returns(AppRoles.Administrator.Name);

            var behavior = new FeaturePermissionBehavior<TestRequest, Unit>(currentUser.Object, db);
            var result = await behavior.Handle(new TestRequest(), Next, CancellationToken.None);

            Assert.Equal(Unit.Value, result);
        }
    }

    public class ClubCommandsPermissionTests
    {
        [Fact]
        public void CreateClubCommand_ImplementsIRequireFeaturePermission_WithClubsRoute()
        {
            var command = new RFFM.Api.Features.Coaches.Clubs.Commands.CreateClubCommand();
            var requirement = Assert.IsAssignableFrom<IRequireFeaturePermission>(command);
            Assert.Equal("/coach/clubs", requirement.FeatureRoute);
            Assert.Equal("Write", requirement.RequiredPermission);
        }

        [Fact]
        public void UpdateClubCommand_ImplementsIRequireFeaturePermission_WithClubsRoute()
        {
            var command = new RFFM.Api.Features.Coaches.Clubs.Commands.UpdateClubCommand();
            var requirement = Assert.IsAssignableFrom<IRequireFeaturePermission>(command);
            Assert.Equal("/coach/clubs", requirement.FeatureRoute);
            Assert.Equal("Write", requirement.RequiredPermission);
        }

        [Fact]
        public void DeleteClubCommand_ImplementsIRequireFeaturePermission_WithClubsRoute()
        {
            var command = new RFFM.Api.Features.Coaches.Clubs.Commands.DeleteClubCommand();
            var requirement = Assert.IsAssignableFrom<IRequireFeaturePermission>(command);
            Assert.Equal("/coach/clubs", requirement.FeatureRoute);
            Assert.Equal("Write", requirement.RequiredPermission);
        }
    }
}
