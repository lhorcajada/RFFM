#nullable enable
using Microsoft.EntityFrameworkCore;
using Moq;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities.Coaches;
using RFFM.Api.Domain.Services;
using RFFM.Api.Features.Coaches.Settings;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class ConfigurationCoachHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public ConfigurationCoachHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static Mock<ICurrentUserService> CurrentUser(string userId)
        {
            var mock = new Mock<ICurrentUserService>();
            mock.Setup(c => c.UserId).Returns(userId);
            mock.Setup(c => c.IsAuthenticated).Returns(true);
            return mock;
        }

        [Fact]
        public async Task GetConfig_ReturnsOnlyOwnRow_NeverAnotherCoachsRow()
        {
            await using var db = _fixture.CreateDbContext();
            var coachA = $"coachA-{Guid.NewGuid():N}";
            var coachB = $"coachB-{Guid.NewGuid():N}";
            db.Set<ConfigurationCoach>().Add(new ConfigurationCoach { CoachId = coachA, PreferredClubId = "club-A" });
            db.Set<ConfigurationCoach>().Add(new ConfigurationCoach { CoachId = coachB, PreferredClubId = "club-B" });
            await db.SaveChangesAsync();

            var handler = new ConfigurationCoachModule.GetConfigHandler(db, CurrentUser(coachA).Object);
            var result = await handler.Handle(new ConfigurationCoachModule.GetConfigQuery(), CancellationToken.None);

            Assert.Single(result);
            Assert.Equal(coachA, result[0].CoachId);
            Assert.Equal("club-A", result[0].PreferredClubId);
        }

        [Fact]
        public async Task GetConfig_NewCoachWithoutOwnRow_ReturnsEmptyArray()
        {
            await using var db = _fixture.CreateDbContext();
            var otherCoach = $"other-{Guid.NewGuid():N}";
            db.Set<ConfigurationCoach>().Add(new ConfigurationCoach { CoachId = otherCoach, PreferredClubId = "club-X" });
            await db.SaveChangesAsync();

            var newCoach = $"new-{Guid.NewGuid():N}";
            var handler = new ConfigurationCoachModule.GetConfigHandler(db, CurrentUser(newCoach).Object);
            var result = await handler.Handle(new ConfigurationCoachModule.GetConfigQuery(), CancellationToken.None);

            Assert.Empty(result);
        }

        [Fact]
        public async Task CreateConfig_IgnoresCoachIdFromBody_UsesTokenUserId()
        {
            await using var db = _fixture.CreateDbContext();
            var tokenUserId = $"token-{Guid.NewGuid():N}";
            var spoofedCoachId = $"spoofed-{Guid.NewGuid():N}";

            var handler = new ConfigurationCoachModule.CreateConfigHandler(db, CurrentUser(tokenUserId).Object);
            var request = new ConfigurationCoachModule.ConfigRequest(spoofedCoachId, "club-1", null);
            var result = await handler.Handle(new ConfigurationCoachModule.CreateConfigCommand(request), CancellationToken.None);

            Assert.Equal(tokenUserId, result.CoachId);
            Assert.NotEqual(spoofedCoachId, result.CoachId);
        }

        [Fact]
        public async Task UpdateConfig_OnAnotherCoachsRow_ThrowsForbiddenAccessException()
        {
            await using var db = _fixture.CreateDbContext();
            var owner = $"owner-{Guid.NewGuid():N}";
            var attacker = $"attacker-{Guid.NewGuid():N}";
            var entity = new ConfigurationCoach { CoachId = owner, PreferredClubId = "club-owner" };
            db.Set<ConfigurationCoach>().Add(entity);
            await db.SaveChangesAsync();

            var handler = new ConfigurationCoachModule.UpdateConfigHandler(db, CurrentUser(attacker).Object);
            var request = new ConfigurationCoachModule.ConfigRequest(attacker, "club-attacker", null);

            await Assert.ThrowsAsync<ForbiddenAccessException>(
                async () => await handler.Handle(new ConfigurationCoachModule.UpdateConfigCommand(entity.Id, request), CancellationToken.None));
        }

        [Fact]
        public async Task UpdateConfig_OnOwnRow_Succeeds()
        {
            await using var db = _fixture.CreateDbContext();
            var owner = $"owner-{Guid.NewGuid():N}";
            var entity = new ConfigurationCoach { CoachId = owner, PreferredClubId = "club-old" };
            db.Set<ConfigurationCoach>().Add(entity);
            await db.SaveChangesAsync();

            var handler = new ConfigurationCoachModule.UpdateConfigHandler(db, CurrentUser(owner).Object);
            var request = new ConfigurationCoachModule.ConfigRequest(owner, "club-new", null);
            var result = await handler.Handle(new ConfigurationCoachModule.UpdateConfigCommand(entity.Id, request), CancellationToken.None);

            Assert.Equal("club-new", result.PreferredClubId);
        }

        [Fact]
        public async Task DeleteConfig_OnAnotherCoachsRow_ThrowsForbiddenAccessException()
        {
            await using var db = _fixture.CreateDbContext();
            var owner = $"owner-{Guid.NewGuid():N}";
            var attacker = $"attacker-{Guid.NewGuid():N}";
            var entity = new ConfigurationCoach { CoachId = owner, PreferredClubId = "club-owner" };
            db.Set<ConfigurationCoach>().Add(entity);
            await db.SaveChangesAsync();

            var handler = new ConfigurationCoachModule.DeleteConfigHandler(db, CurrentUser(attacker).Object);

            await Assert.ThrowsAsync<ForbiddenAccessException>(
                async () => await handler.Handle(new ConfigurationCoachModule.DeleteConfigCommand(entity.Id), CancellationToken.None));
        }

        [Fact]
        public async Task DeleteConfig_OnOwnRow_Succeeds()
        {
            await using var db = _fixture.CreateDbContext();
            var owner = $"owner-{Guid.NewGuid():N}";
            var entity = new ConfigurationCoach { CoachId = owner, PreferredClubId = "club-owner" };
            db.Set<ConfigurationCoach>().Add(entity);
            await db.SaveChangesAsync();

            var handler = new ConfigurationCoachModule.DeleteConfigHandler(db, CurrentUser(owner).Object);
            var result = await handler.Handle(new ConfigurationCoachModule.DeleteConfigCommand(entity.Id), CancellationToken.None);

            Assert.Equal(entity.Id, result.Id);
        }
    }
}
