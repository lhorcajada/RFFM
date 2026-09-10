#nullable enable
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.Convocations;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    /// <summary>
    /// Coverage for GetConvocationNotificationRecipients.Handler (openspec change
    /// convocation-pending-confirmation-whatsapp) — resolves, per requested teamPlayerId, which
    /// family members are eligible WhatsApp notification recipients (RegistrationStatus ==
    /// Approved and a non-empty phone). Runs against a real Postgres instance (Testcontainers),
    /// same pattern as GetEventConvocationsHandlerTests / GetTeamPlayerHandlerTests.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class GetConvocationNotificationRecipientsHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GetConvocationNotificationRecipientsHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<(string EventId, string TeamId, string TeamPlayerId)> SeedConvokedPlayerAsync(
            AppDbContext db, string aliasPrefix = "testplayer")
        {
            var club = Club.Create($"GetConvocationNotificationRecipients Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create(
                $"Season {Guid.NewGuid():N}",
                DateTime.UtcNow,
                DateTime.UtcNow.AddMonths(9),
                isActive: true,
                club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "GetConvocationNotificationRecipients Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var player = Player.Create(new PlayerModelBase
            {
                Name = "Test",
                LastName = "Player",
                Alias = $"{aliasPrefix}-{Guid.NewGuid():N}",
                ClubId = club.Id
            });
            db.Players.Add(player);
            await db.SaveChangesAsync();

            var teamPlayer = TeamPlayer.Create(new TeamPlayerModel
            {
                PlayerId = player.Id,
                TeamId = team.Id,
                SeasonId = season.Id,
                JoinedDate = DateTime.UtcNow,
                Dorsal = null,
                FamilyMembers = new List<FamilyModel>()
            });
            db.TeamPlayers.Add(teamPlayer);
            await db.SaveChangesAsync();

            var sportEvent = SportEvent.CreateNew(
                "GetConvocationNotificationRecipients Test Event",
                DateTime.UtcNow.AddDays(1),
                DateTime.UtcNow.AddDays(1),
                null, null, null, null,
                eventTypeId: 1, team.Id, null);
            db.SportEvents.Add(sportEvent);
            await db.SaveChangesAsync();

            var convocation = Convocation.Create(new ConvocationModel
            {
                EventId = sportEvent.Id,
                TeamPlayerId = teamPlayer.Id,
                AssistanceTypeId = null,
                ResponseDateTime = DateTime.UtcNow,
                ConvocationStatusId = 1,
                ExcuseTypeId = null
            });
            db.Convocations.Add(convocation);
            await db.SaveChangesAsync();

            return (sportEvent.Id, team.Id, teamPlayer.Id);
        }

        [Fact]
        public async Task Handle_PlayerWithApprovedFamilyMemberWithPhone_ReturnsRecipient()
        {
            await using var setupDb = _fixture.CreateDbContext();
            var (eventId, teamId, teamPlayerId) = await SeedConvokedPlayerAsync(setupDb);

            var familyMember = TeamPlayerFamilyMember.Create(
                teamPlayerId, "Jane", "Doe", "600123456", "jane@rffm.test", "12345678A", "Madre");
            familyMember.LinkAccount($"user-{Guid.NewGuid():N}");
            setupDb.TeamPlayerFamilyMembers.Add(familyMember);
            await setupDb.SaveChangesAsync();

            await using var db = _fixture.CreateDbContext();
            var handler = new GetConvocationNotificationRecipients.Handler(db);

            var response = await handler.Handle(
                new GetConvocationNotificationRecipients.ConvocationNotificationRecipientsQuery
                {
                    EventId = eventId,
                    TeamId = teamId,
                    TeamPlayerIds = new[] { teamPlayerId }
                },
                CancellationToken.None);

            var playerRecipients = Assert.Single(response.Players);
            Assert.Equal(teamPlayerId, playerRecipients.TeamPlayerId);
            var recipient = Assert.Single(playerRecipients.FamilyMembers);
            Assert.Equal(familyMember.Id, recipient.FamilyMemberId);
            Assert.Equal("Jane", recipient.Name);
            Assert.Equal("Doe", recipient.LastName);
            Assert.Equal("600123456", recipient.Phone);
            Assert.Equal("Madre", recipient.FamilyMember);
        }

        [Fact]
        public async Task Handle_PlayerWithNoApprovedFamilyMembers_ReturnsEmptyFamilyMembers()
        {
            await using var setupDb = _fixture.CreateDbContext();
            var (eventId, teamId, teamPlayerId) = await SeedConvokedPlayerAsync(setupDb);

            // A family member that never registered an account (None) and never will be a recipient.
            var familyMember = TeamPlayerFamilyMember.Create(
                teamPlayerId, "Jane", "Doe", "600123456", "jane@rffm.test", "12345678A", "Madre");
            setupDb.TeamPlayerFamilyMembers.Add(familyMember);
            await setupDb.SaveChangesAsync();

            await using var db = _fixture.CreateDbContext();
            var handler = new GetConvocationNotificationRecipients.Handler(db);

            var response = await handler.Handle(
                new GetConvocationNotificationRecipients.ConvocationNotificationRecipientsQuery
                {
                    EventId = eventId,
                    TeamId = teamId,
                    TeamPlayerIds = new[] { teamPlayerId }
                },
                CancellationToken.None);

            var playerRecipients = Assert.Single(response.Players);
            Assert.Equal(teamPlayerId, playerRecipients.TeamPlayerId);
            Assert.Empty(playerRecipients.FamilyMembers);
        }

        [Fact]
        public async Task Handle_PlayerWithoutAnyFamilyMembers_ReturnsEmptyFamilyMembers()
        {
            await using var setupDb = _fixture.CreateDbContext();
            var (eventId, teamId, teamPlayerId) = await SeedConvokedPlayerAsync(setupDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new GetConvocationNotificationRecipients.Handler(db);

            var response = await handler.Handle(
                new GetConvocationNotificationRecipients.ConvocationNotificationRecipientsQuery
                {
                    EventId = eventId,
                    TeamId = teamId,
                    TeamPlayerIds = new[] { teamPlayerId }
                },
                CancellationToken.None);

            var playerRecipients = Assert.Single(response.Players);
            Assert.Empty(playerRecipients.FamilyMembers);
        }

        [Fact]
        public async Task Handle_ApprovedFamilyMemberWithoutPhone_IsExcludedFromRecipients()
        {
            await using var setupDb = _fixture.CreateDbContext();
            var (eventId, teamId, teamPlayerId) = await SeedConvokedPlayerAsync(setupDb);

            var withoutPhone = TeamPlayerFamilyMember.Create(
                teamPlayerId, "NoPhone", "Family", null, "nophone@rffm.test", "12345678A", "Padre");
            withoutPhone.LinkAccount($"user-{Guid.NewGuid():N}");
            setupDb.TeamPlayerFamilyMembers.Add(withoutPhone);

            var withBlankPhone = TeamPlayerFamilyMember.Create(
                teamPlayerId, "BlankPhone", "Family", "   ", "blank@rffm.test", "87654321B", "Madre");
            withBlankPhone.LinkAccount($"user-{Guid.NewGuid():N}");
            setupDb.TeamPlayerFamilyMembers.Add(withBlankPhone);

            await setupDb.SaveChangesAsync();

            await using var db = _fixture.CreateDbContext();
            var handler = new GetConvocationNotificationRecipients.Handler(db);

            var response = await handler.Handle(
                new GetConvocationNotificationRecipients.ConvocationNotificationRecipientsQuery
                {
                    EventId = eventId,
                    TeamId = teamId,
                    TeamPlayerIds = new[] { teamPlayerId }
                },
                CancellationToken.None);

            var playerRecipients = Assert.Single(response.Players);
            Assert.Empty(playerRecipients.FamilyMembers);
        }

        [Fact]
        public async Task Handle_RequestedTeamPlayerIdWithoutConvocationForEvent_DoesNotErrorTheBatch()
        {
            await using var setupDb = _fixture.CreateDbContext();
            var (eventId, teamId, convokedTeamPlayerId) = await SeedConvokedPlayerAsync(setupDb, "convoked");

            var familyMember = TeamPlayerFamilyMember.Create(
                convokedTeamPlayerId, "Jane", "Doe", "600123456", "jane@rffm.test", "12345678A", "Madre");
            familyMember.LinkAccount($"user-{Guid.NewGuid():N}");
            setupDb.TeamPlayerFamilyMembers.Add(familyMember);
            await setupDb.SaveChangesAsync();

            var staleTeamPlayerId = $"not-convoked-{Guid.NewGuid():N}";

            await using var db = _fixture.CreateDbContext();
            var handler = new GetConvocationNotificationRecipients.Handler(db);

            var response = await handler.Handle(
                new GetConvocationNotificationRecipients.ConvocationNotificationRecipientsQuery
                {
                    EventId = eventId,
                    TeamId = teamId,
                    TeamPlayerIds = new[] { convokedTeamPlayerId, staleTeamPlayerId }
                },
                CancellationToken.None);

            // The stale id must not blow up the whole request; the convoked player is still returned.
            var playerRecipients = Assert.Single(response.Players);
            Assert.Equal(convokedTeamPlayerId, playerRecipients.TeamPlayerId);
            Assert.Single(playerRecipients.FamilyMembers);
        }

        [Fact]
        public void Query_DeclaresConvocationsReadFeaturePermission()
        {
            var query = new GetConvocationNotificationRecipients.ConvocationNotificationRecipientsQuery
            {
                EventId = "event-1",
                TeamId = "team-1",
                TeamPlayerIds = Array.Empty<string>()
            };

            Assert.Equal(RFFM.Api.Domain.Entities.CoachFeatureRoutes.Convocations, query.FeatureRoute);
            Assert.Equal("Read", query.RequiredPermission);
            Assert.Equal("team-1", query.TeamId);
        }
    }
}
