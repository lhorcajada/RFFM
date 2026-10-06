#nullable enable
using System.Linq;
using RFFM.Api.Features.Federation.Players.Models;
using RFFM.Api.Features.Federation.Teams.Services;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class SquadPlayerMatcherTests
    {
        private static SquadDbPlayer Db(string id, string name, int? birthYear = null, string? photo = null, int? dorsal = null)
            => new(id, name, birthYear, photo, dorsal);

        private static SquadRffmPlayer Rffm(string id, string name, int? birthYear = null, string? photo = null, string? jersey = null,
            SeasonStats? stats = null)
            => new(id, name, birthYear, photo, jersey, stats);

        private static readonly SeasonStats SomeStats = new(Called: 8, Starter: 6, Substitute: 2, Played: 8, Goals: 3, Yellow: 1, Red: 0, DoubleYellow: 0);

        [Fact]
        public void Compare_ShouldMarkLicensed_WhenNamesMatchIgnoringAccentsCaseAndOrder()
        {
            var result = SquadPlayerMatcher.Compare(
                [Db("tp1", "José Pérez", 2012)],
                [Rffm("r1", "PEREZ, JOSE", 2012)]);

            var player = Assert.Single(result);
            Assert.Equal(ComparedPlayerStatus.Licensed, player.Status);
            Assert.Equal("tp1", player.TeamPlayerId);
            Assert.Equal("r1", player.RffmPlayerId);
        }

        [Fact]
        public void Compare_ShouldMarkLicensed_WhenRffmHasBothSurnamesAndDbOnlyOne()
        {
            var result = SquadPlayerMatcher.Compare(
                [Db("tp1", "José Pérez", 2012)],
                [Rffm("r1", "PEREZ GARCIA, JOSE", 2012)]);

            Assert.Equal(ComparedPlayerStatus.Licensed, Assert.Single(result).Status);
        }

        [Fact]
        public void Compare_ShouldNotMatch_WhenBirthYearsDiffer()
        {
            var result = SquadPlayerMatcher.Compare(
                [Db("tp1", "José Pérez", 2012)],
                [Rffm("r1", "PEREZ, JOSE", 2011)]);

            Assert.Equal(2, result.Count);
            Assert.Equal(ComparedPlayerStatus.Unlicensed, result.Single(p => p.TeamPlayerId == "tp1").Status);
            Assert.Equal(ComparedPlayerStatus.NotInTeam, result.Single(p => p.RffmPlayerId == "r1").Status);
        }

        [Fact]
        public void Compare_ShouldMatch_WhenRffmBirthYearIsUnknown()
        {
            var result = SquadPlayerMatcher.Compare(
                [Db("tp1", "José Pérez", 2012)],
                [Rffm("r1", "PEREZ, JOSE")]);

            Assert.Equal(ComparedPlayerStatus.Licensed, Assert.Single(result).Status);
        }

        [Fact]
        public void Compare_ShouldMarkUnlicensed_WhenPlayerIsOnlyInDatabase()
        {
            var result = SquadPlayerMatcher.Compare([Db("tp1", "Mario Gómez")], []);

            Assert.Equal(ComparedPlayerStatus.Unlicensed, Assert.Single(result).Status);
        }

        [Fact]
        public void Compare_ShouldMarkNotInTeamWithRffmPhotoAndJersey_WhenPlayerIsOnlyInRffm()
        {
            var result = SquadPlayerMatcher.Compare([], [Rffm("r1", "RUIZ, ANA", 2012, "rffm.jpg", "7")]);

            var player = Assert.Single(result);
            Assert.Equal(ComparedPlayerStatus.NotInTeam, player.Status);
            Assert.Equal("RUIZ, ANA", player.Name);
            Assert.Equal("rffm.jpg", player.PhotoUrl);
            Assert.Equal("7", player.JerseyNumber);
        }

        [Fact]
        public void Compare_ShouldMatchEachRffmPlayerOnlyOnce()
        {
            var result = SquadPlayerMatcher.Compare(
                [Db("tp1", "José Pérez"), Db("tp2", "José Pérez")],
                [Rffm("r1", "PEREZ, JOSE")]);

            Assert.Single(result, p => p.Status == ComparedPlayerStatus.Licensed);
            Assert.Single(result, p => p.Status == ComparedPlayerStatus.Unlicensed);
        }

        [Fact]
        public void Compare_ShouldPreferCandidateSharingMoreTokens()
        {
            var result = SquadPlayerMatcher.Compare(
                [Db("tp1", "José Pérez García")],
                [Rffm("r1", "PEREZ, JOSE"), Rffm("r2", "PEREZ GARCIA, JOSE")]);

            Assert.Equal("r2", result.Single(p => p.TeamPlayerId == "tp1").RffmPlayerId);
        }

        [Fact]
        public void Compare_ShouldUseDatabasePhotoAndDorsal_WhenAvailable()
        {
            var result = SquadPlayerMatcher.Compare(
                [Db("tp1", "José Pérez", photo: "db.jpg", dorsal: 10)],
                [Rffm("r1", "PEREZ, JOSE", photo: "rffm.jpg", jersey: "3")]);

            var player = Assert.Single(result);
            Assert.Equal("José Pérez", player.Name);
            Assert.Equal("db.jpg", player.PhotoUrl);
            Assert.Equal("10", player.JerseyNumber);
        }

        [Fact]
        public void Compare_ShouldFallBackToRffmPhotoAndJersey_WhenDatabaseHasNone()
        {
            var result = SquadPlayerMatcher.Compare(
                [Db("tp1", "José Pérez")],
                [Rffm("r1", "PEREZ, JOSE", photo: "rffm.jpg", jersey: "3")]);

            var player = Assert.Single(result);
            Assert.Equal("rffm.jpg", player.PhotoUrl);
            Assert.Equal("3", player.JerseyNumber);
        }

        [Fact]
        public void Compare_ShouldCarryRffmStats_WhenPlayerIsLicensed()
        {
            var result = SquadPlayerMatcher.Compare([Db("tp1", "José Pérez")], [Rffm("r1", "PEREZ, JOSE", stats: SomeStats)]);

            Assert.Equal(SomeStats, Assert.Single(result).Stats);
        }

        [Fact]
        public void Compare_ShouldCarryRffmStats_WhenPlayerIsNotInTeam()
        {
            var result = SquadPlayerMatcher.Compare([], [Rffm("r1", "RUIZ, ANA", stats: SomeStats)]);

            Assert.Equal(SomeStats, Assert.Single(result).Stats);
        }

        [Fact]
        public void Compare_ShouldHaveNoStats_WhenPlayerIsUnlicensed()
        {
            var result = SquadPlayerMatcher.Compare([Db("tp1", "Mario Gómez")], []);

            Assert.Null(Assert.Single(result).Stats);
        }

        [Fact]
        public void Compare_ShouldOrderByDorsalThenNameWithNotInTeamLast()
        {
            var result = SquadPlayerMatcher.Compare(
                [Db("tp1", "Carlos Sanz", dorsal: 9), Db("tp2", "Bruno Díaz", dorsal: 2), Db("tp3", "Alberto Gil")],
                [Rffm("r1", "ARIAS, ZOE")]);

            Assert.Equal(["tp2", "tp1", "tp3", null], result.Select(p => p.TeamPlayerId).ToArray());
        }
    }
}
