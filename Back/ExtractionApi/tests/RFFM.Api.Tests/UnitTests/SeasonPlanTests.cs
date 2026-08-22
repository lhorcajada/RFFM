#nullable enable
using System;
using System.Collections.Generic;
using RFFM.Api.Domain.Aggregates.SeasonPlans;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class SeasonPlanTests
    {
        [Fact]
        public void Create_WithValidData_SetsProperties()
        {
            var plan = new SeasonPlan("team-1", "season-1");

            Assert.Equal("team-1", plan.TeamId);
            Assert.Equal("season-1", plan.SeasonId);
            Assert.Empty(plan.Macrociclos);
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData(null)]
        public void Create_WithEmptyTeamId_Throws(string? teamId)
        {
            Assert.Throws<ArgumentException>(() => new SeasonPlan(teamId!, "season-1"));
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData(null)]
        public void Create_WithEmptySeasonId_Throws(string? seasonId)
        {
            Assert.Throws<ArgumentException>(() => new SeasonPlan("team-1", seasonId!));
        }
    }

    public class MacrocicloTests
    {
        [Fact]
        public void Create_WithValidData_SetsProperties()
        {
            var macrociclo = new Macrociclo("plan-1", 1, "Macrociclo 1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 21));

            Assert.Equal("plan-1", macrociclo.SeasonPlanId);
            Assert.Equal(1, macrociclo.Order);
            Assert.Equal("Macrociclo 1", macrociclo.Name);
            Assert.Equal(new DateOnly(2026, 9, 1), macrociclo.StartDate);
            Assert.Equal(new DateOnly(2026, 9, 21), macrociclo.EndDate);
            Assert.Empty(macrociclo.Mesociclos);
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData(null)]
        public void Create_WithEmptyName_Throws(string? name)
        {
            Assert.Throws<ArgumentException>(() => new Macrociclo("plan-1", 1, name!, new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 21)));
        }

        [Fact]
        public void Create_WithEndDateBeforeStartDate_Throws()
        {
            Assert.Throws<ArgumentException>(() => new Macrociclo("plan-1", 1, "Macrociclo 1", new DateOnly(2026, 9, 21), new DateOnly(2026, 9, 1)));
        }

        [Fact]
        public void UpdateName_TrimsAndSets()
        {
            var macrociclo = new Macrociclo("plan-1", 1, "Macrociclo 1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 21));

            macrociclo.UpdateName("  Editado  ");

            Assert.Equal("Editado", macrociclo.Name);
        }

        [Fact]
        public void Reschedule_WithValidRange_UpdatesDates()
        {
            var macrociclo = new Macrociclo("plan-1", 1, "Macrociclo 1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 21));

            macrociclo.Reschedule(new DateOnly(2026, 10, 1), new DateOnly(2026, 10, 21));

            Assert.Equal(new DateOnly(2026, 10, 1), macrociclo.StartDate);
            Assert.Equal(new DateOnly(2026, 10, 21), macrociclo.EndDate);
        }
    }

    public class MesocicloTests
    {
        [Fact]
        public void Create_WithValidData_SetsProperties()
        {
            var mesociclo = new Mesociclo("macrociclo-1", 1, "Mesociclo 1.1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 21), gameZoneId: 2);

            Assert.Equal("macrociclo-1", mesociclo.MacrocicloId);
            Assert.Equal(2, mesociclo.GameZoneId);
            Assert.Empty(mesociclo.Microciclos);
        }

        [Fact]
        public void Create_WithZeroGameZoneId_Throws()
        {
            Assert.Throws<ArgumentException>(() => new Mesociclo("macrociclo-1", 1, "Mesociclo 1.1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 21), gameZoneId: 0));
        }

        [Fact]
        public void UpdateGameZoneId_WithPositiveValue_Sets()
        {
            var mesociclo = new Mesociclo("macrociclo-1", 1, "Mesociclo 1.1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 21), gameZoneId: 2);

            mesociclo.UpdateGameZoneId(4);

            Assert.Equal(4, mesociclo.GameZoneId);
        }
    }

    public class MicrocicloTests
    {
        [Fact]
        public void Create_WithValidData_SetsProperties()
        {
            var microciclo = new Microciclo("mesociclo-1", 1, "Semana 1 — Analítico", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7));

            Assert.Equal("mesociclo-1", microciclo.MesocicloId);
            Assert.Equal(1, microciclo.Order);
            Assert.Equal("Semana 1 — Analítico", microciclo.WeekLabel);
            Assert.Equal(new DateOnly(2026, 9, 1), microciclo.StartDate);
            Assert.Equal(new DateOnly(2026, 9, 7), microciclo.EndDate);
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData(null)]
        public void Create_WithEmptyWeekLabel_Throws(string? weekLabel)
        {
            Assert.Throws<ArgumentException>(() => new Microciclo(
                "mesociclo-1", 1, weekLabel!, new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7)));
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData(null)]
        public void Create_WithEmptyMesocicloId_Throws(string? mesocicloId)
        {
            Assert.Throws<ArgumentException>(() => new Microciclo(
                mesocicloId!, 1, "Semana 1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7)));
        }

        [Fact]
        public void Create_WithEndDateBeforeStartDate_Throws()
        {
            Assert.Throws<ArgumentException>(() => new Microciclo(
                "mesociclo-1", 1, "Semana 1", new DateOnly(2026, 9, 7), new DateOnly(2026, 9, 1)));
        }

        [Fact]
        public void UpdateWeekLabel_TrimsAndSets()
        {
            var microciclo = new Microciclo("mesociclo-1", 1, "Semana 1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7));

            microciclo.UpdateWeekLabel("  Semana editada  ");

            Assert.Equal("Semana editada", microciclo.WeekLabel);
        }

        [Fact]
        public void Reschedule_WithValidRange_UpdatesDates()
        {
            var microciclo = new Microciclo("mesociclo-1", 1, "Semana 1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7));

            microciclo.Reschedule(new DateOnly(2026, 10, 1), new DateOnly(2026, 10, 7));

            Assert.Equal(new DateOnly(2026, 10, 1), microciclo.StartDate);
            Assert.Equal(new DateOnly(2026, 10, 7), microciclo.EndDate);
        }
    }
}
