#nullable enable
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.AiProviders;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.Users.Commands;
using RFFM.Api.Features.Scopes;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Edge case E3 of openspec change ai-provider-settings: deleting a user removes the AI providers
    /// (and their stored keys) of that user and nobody else's.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class DeleteTeamUserAccountAiProvidersTests
    {
        private readonly PostgresContainerFixture _fixture;

        public DeleteTeamUserAccountAiProvidersTests(PostgresContainerFixture fixture) => _fixture = fixture;

        private static AiProviderSetting NewProvider(string userId) =>
            AiProviderSetting.Create(userId, AiProviderTemplates.OpenAi, "https://api.openai.com/v1", "gpt-4o-mini", "encrypted-key", "1234");

        private static DeleteTeamUserAccount.Handler CreateHandler(AppDbContext db)
        {
            var userManager = new Mock<UserManager<IdentityUser>>(
                new Mock<IUserStore<IdentityUser>>().Object, null!, null!, null!, null!, null!, null!, null!, null!);

            var scopeAuth = new Mock<IScopeAuthorizationService>();
            scopeAuth
                .Setup(s => s.EnsureMemberAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(ScopeAuthorizationResult.Ok(new ScopeContext { Kind = ScopeKinds.Team, Id = "team" }));
            scopeAuth
                .Setup(s => s.EnsureSubscriptionActiveOrEvictAsync(It.IsAny<ScopeContext>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new SubscriptionEvictionResult { IsActive = true });

            return new DeleteTeamUserAccount.Handler(db, userManager.Object, scopeAuth.Object, NullLogger<DeleteTeamUserAccount.Handler>.Instance);
        }

        private async Task<string> CreateTeamAsync()
        {
            await using var db = _fixture.CreateDbContext();

            var club = Club.Create($"AiProviders Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "AiProviders Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            return team.Id;
        }

        [Fact]
        public async Task DeletingATeamUser_RemovesThatUsersAiProvidersAndKeepsOthers()
        {
            var teamId = await CreateTeamAsync();
            var callerId = Guid.NewGuid().ToString();
            var deletedUserId = Guid.NewGuid().ToString();
            var otherUserId = Guid.NewGuid().ToString();
            string membershipId;

            await using (var seedDb = _fixture.CreateDbContext())
            {
                var membership = new UserTeam(deletedUserId, teamId, Membership.Player.Id);
                seedDb.UserTeams.Add(membership);
                seedDb.AiProviderSettings.AddRange(NewProvider(deletedUserId), NewProvider(deletedUserId), NewProvider(otherUserId));
                await seedDb.SaveChangesAsync();
                membershipId = membership.Id;
            }

            await using var db = _fixture.CreateDbContext();
            var result = await CreateHandler(db).Handle(
                new DeleteTeamUserAccount.Command { CallerUserId = callerId, MembershipId = membershipId },
                CancellationToken.None);

            Assert.IsAssignableFrom<IResult>(result);
            await using var verifyDb = _fixture.CreateDbContext();
            Assert.False(await verifyDb.UserTeams.AnyAsync(ut => ut.Id == membershipId));
            Assert.False(await verifyDb.AiProviderSettings.AnyAsync(p => p.UserId == deletedUserId));
            Assert.Equal(1, await verifyDb.AiProviderSettings.CountAsync(p => p.UserId == otherUserId));
        }
    }
}
