#nullable enable
using Microsoft.EntityFrameworkCore;
using Moq;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Federation.Results;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.Teams;
using RFFM.Api.Domain.Models;
using RFFM.Api.Domain.Services;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;

namespace RFFM.Api.Tests.UnitTests
{
    internal sealed record QuinielaSeed(
        string TeamId, int GroupId, string CoachId, string PlayerId, string FamilyId, string FollowerId, string OutsiderId,
        string ClubCoachId, string ClubDirectiveId, string OtherClubCoachId)
    {
        public string GroupCode => GroupId.ToString();

        /// <summary>Usuario de club (sin fila en UserTeams) o de otro club, según el nombre del caso.</summary>
        public string ClubUser(string who) => who switch
        {
            "clubcoach" => ClubCoachId,
            "directive" => ClubDirectiveId,
            _ => OtherClubCoachId
        };
    }

    /// <summary>Datos de prueba compartidos por los tests de los features de quiniela.</summary>
    internal static class QuinielaTestSupport
    {
        // Miércoles anterior a la jornada (sábado 2026-11-07): los pronósticos están abiertos y el plazo de pago no ha vencido.
        public static readonly DateTime BeforeKickoff = new(2026, 11, 4, 10, 0, 0, DateTimeKind.Utc);
        // Domingo posterior: plazo de pago (viernes 23:59) vencido y partidos jugados.
        public static readonly DateTime AfterMatches = new(2026, 11, 8, 20, 0, 0, DateTimeKind.Utc);

        public static TimeProvider ClockAt(DateTime utcNow) => new FixedTimeProvider(utcNow);

        public static ICurrentUserService User(string? userId)
        {
            var mock = new Mock<ICurrentUserService>();
            mock.SetupGet(u => u.UserId).Returns(userId);
            mock.SetupGet(u => u.IsAuthenticated).Returns(userId is not null);
            mock.SetupGet(u => u.Roles).Returns(Array.Empty<string>());
            return mock.Object;
        }

        public static async Task<QuinielaSeed> SeedTeamAsync(PostgresContainerFixture fixture, bool withLeague = true)
        {
            await using var db = fixture.CreateDbContext();
            var club = Club.Create($"Quiniela Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase { Name = "Quiniela Team", CategoryId = Category.U14.Id, ClubId = club.Id, SeasonId = season.Id });
            var groupId = Random.Shared.Next(100_000, int.MaxValue);
            if (withLeague)
            {
                team.UpdateRffmCompetitionId(Random.Shared.Next(100_000, int.MaxValue));
                team.UpdateRffmGroupId(groupId);
            }
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            string NewId(string prefix) => $"{prefix}-{Guid.NewGuid():N}";
            var seed = new QuinielaSeed(team.Id, groupId, NewId("coach"), NewId("player"), NewId("family"), NewId("follower"), NewId("outsider"),
                NewId("clubcoach"), NewId("directive"), NewId("otherclub"));
            db.UserTeams.Add(new UserTeam(seed.CoachId, team.Id, Membership.Coach.Id));
            db.UserTeams.Add(new UserTeam(seed.PlayerId, team.Id, Membership.Player.Id));
            db.UserTeams.Add(new UserTeam(seed.FamilyId, team.Id, Membership.FamilyPlayer.Id));
            db.UserTeams.Add(new UserTeam(seed.FollowerId, team.Id, Membership.Follower.Id));
            var otherClub = Club.Create($"Quiniela Other Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(otherClub);
            await db.SaveChangesAsync();
            db.UserClubs.Add(new UserClub(seed.ClubCoachId, club.Id, Membership.Coach.Id));
            db.UserClubs.Add(new UserClub(seed.ClubDirectiveId, club.Id, Membership.Directive.Id));
            db.UserClubs.Add(new UserClub(seed.OtherClubCoachId, otherClub.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();
            return seed;
        }

        public static RffmMatchSnapshot Match(string code, string date, string time, string home = "Local", string away = "Visitante",
            string? score = null, string status = "", string statusReason = "", string gameSituation = "") => new()
        {
            RecordCode = code,
            Date = date,
            Time = time,
            LocalTeamName = home,
            VisitorTeamName = away,
            RecordClosed = score is null ? "0" : "1",
            LocalGoals = score is null ? "" : score.Split('-')[0],
            VisitorGoals = score is null ? "" : score.Split('-')[1],
            Status = status,
            StatusReason = statusReason,
            GameSituation = gameSituation
        };

        /// <summary>Jornada 1: A (sáb 16:00), B (sáb 18:00), C (dom 12:00, el Pleno) y opcionalmente D aplazado.</summary>
        public static RffmMatchSnapshot[] StandardMatches(string suffix, string? scoreA = null, string? scoreB = null, string? scoreC = null, bool postponedD = false)
        {
            var matches = new List<RffmMatchSnapshot>
            {
                Match($"A{suffix}", "07/11/2026", "16:00", score: scoreA),
                Match($"B{suffix}", "07/11/2026", "18:00", score: scoreB),
                Match($"C{suffix}", "08/11/2026", "12:00", score: scoreC)
            };
            if (postponedD)
                matches.Add(Match($"D{suffix}", "09/11/2026", "20:00", statusReason: "Aplazado"));
            return matches.ToArray();
        }

        public static async Task<string> SeedRoundAsync(PostgresContainerFixture fixture, string groupCode, int number, params RffmMatchSnapshot[] matches)
        {
            await using var fed = fixture.CreateFederationDbContext();
            var round = await fed.RffmRounds.Include(r => r.Matches).SingleOrDefaultAsync(r => r.GroupCode == groupCode && r.Number == number);
            if (round is null)
            {
                round = RffmRound.Create(groupCode, number, $"Jornada {number}", new DateOnly(2026, 11, 7));
                fed.RffmRounds.Add(round);
            }
            round.ApplySnapshot(matches, DateTime.UtcNow);
            await fed.SaveChangesAsync();
            return round.Id;
        }

        public static async Task<QuinielaJornada> SeedJornadaAsync(PostgresContainerFixture fixture, string teamId, string roundId, decimal carryIn = 0m)
        {
            await using var db = fixture.CreateDbContext();
            var jornada = QuinielaJornada.Create(teamId, roundId, carryIn, 1m, 55m);
            db.QuinielaJornadas.Add(jornada);
            await db.SaveChangesAsync();
            return jornada;
        }

        public static async Task<QuinielaTicket> SeedTicketAsync(PostgresContainerFixture fixture, string jornadaId, string userId,
            string suffix, QuinielaSign a, QuinielaSign b, QuinielaSign c, int plenoHome = 0, int plenoAway = 1, bool paid = false)
        {
            await using var db = fixture.CreateDbContext();
            var ticket = QuinielaTicket.Create(jornadaId, userId,
                [new($"A{suffix}", a), new($"B{suffix}", b), new($"C{suffix}", c)], plenoHome, plenoAway);
            if (paid)
                ticket.MarkPaid(QuinielaPaymentMethod.Cash, BeforeKickoff);
            db.QuinielaTickets.Add(ticket);
            await db.SaveChangesAsync();
            return ticket;
        }
    }
}
