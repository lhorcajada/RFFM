#nullable enable
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Moq;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Domain.Services;

namespace RFFM.Api.Tests.UnitTests
{
    internal static class AvailabilityTestSupport
    {
        internal const int LeagueMatchTypeId = 1;
        internal const int TrainingTypeId = 2;
        internal const int FriendlyTypeId = 4;

        internal static async Task<(string TeamId, string ClubId, string SeasonId)> SeedTeamAsync(AppDbContext db)
        {
            var club = Club.Create($"Availability Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "Availability Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            return (team.Id, club.Id, season.Id);
        }

        internal static async Task<string> SeedPlayerAsync(AppDbContext db, string teamId, string clubId, string seasonId, string? alias = null)
        {
            var player = Player.Create(new PlayerModelBase
            {
                Name = "Test",
                LastName = "Player",
                Alias = alias ?? $"availability-{Guid.NewGuid():N}",
                ClubId = clubId
            });
            db.Players.Add(player);
            await db.SaveChangesAsync();

            var teamPlayer = TeamPlayer.Create(new TeamPlayerModel
            {
                PlayerId = player.Id,
                TeamId = teamId,
                SeasonId = seasonId,
                JoinedDate = DateTime.UtcNow,
                Dorsal = null,
                FamilyMembers = new List<FamilyModel>()
            });
            db.TeamPlayers.Add(teamPlayer);
            await db.SaveChangesAsync();
            return teamPlayer.Id;
        }

        internal static async Task<string> SeedEventAsync(AppDbContext db, string teamId, int eventTypeId, DateTime? date = null, string name = "Jornada 5 - CD Ejemplo")
        {
            var eventDate = date ?? DateTime.UtcNow.AddDays(3);
            var sportEvent = SportEvent.CreateNew(name, eventDate, eventDate, null, null, null, null, eventTypeId, teamId, null);
            db.SportEvents.Add(sportEvent);
            await db.SaveChangesAsync();
            return sportEvent.Id;
        }

        internal static async Task<string> SeedCoachAsync(AppDbContext db, string teamId)
        {
            var coachUserId = Guid.NewGuid().ToString();
            db.Set<UserTeam>().Add(new UserTeam(coachUserId, teamId, Membership.Coach.Id));
            await db.SaveChangesAsync();
            return coachUserId;
        }

        internal static async Task<string> SeedPlayerUserAsync(AppDbContext db, string teamPlayerId, string role = "Player")
        {
            var userId = $"{role.ToLowerInvariant()}-{Guid.NewGuid():N}";
            db.UserProfiles.Add(new UserProfile(userId, role, teamPlayerId, null));
            await db.SaveChangesAsync();
            return userId;
        }

        internal static async Task<string> SeedRequestAsync(AppDbContext db, string eventId, string teamPlayerId, AvailabilityRequestStatus status)
        {
            var request = AvailabilityRequest.Create(eventId, teamPlayerId, DateTime.UtcNow);
            if (status == AvailabilityRequestStatus.Available) request.MarkAvailable(DateTime.UtcNow);
            if (status == AvailabilityRequestStatus.Unavailable) request.MarkUnavailable(DateTime.UtcNow);
            db.AvailabilityRequests.Add(request);
            await db.SaveChangesAsync();
            return request.Id;
        }

        internal static async Task SeedConvocationAsync(AppDbContext db, string eventId, string teamPlayerId, int statusId, int? excuseTypeId = null)
        {
            db.Convocations.Add(Convocation.Create(new ConvocationModel
            {
                EventId = eventId,
                TeamPlayerId = teamPlayerId,
                ConvocationStatusId = statusId,
                ExcuseTypeId = excuseTypeId
            }));
            await db.SaveChangesAsync();
        }

        internal static ICurrentUserService CurrentUser(string userId, params string[] roles)
        {
            var mock = new Mock<ICurrentUserService>();
            mock.Setup(c => c.UserId).Returns(userId);
            mock.Setup(c => c.IsAuthenticated).Returns(true);
            mock.Setup(c => c.Roles).Returns(roles);
            return mock.Object;
        }
    }
}
