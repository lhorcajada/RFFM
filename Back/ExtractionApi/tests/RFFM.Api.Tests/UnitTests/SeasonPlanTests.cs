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
            var microciclo = new Microciclo("mesociclo-1", 1, "Semana 1 — Analítico", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7),
                "Objetivo sesión A", "Objetivo sesión B");

            Assert.Equal("mesociclo-1", microciclo.MesocicloId);
            Assert.Equal("Semana 1 — Analítico", microciclo.WeekLabel);
            Assert.Equal("Objetivo sesión A", microciclo.ObjetivoSesionA);
            Assert.Equal("Objetivo sesión B", microciclo.ObjetivoSesionB);
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData(null)]
        public void Create_WithEmptyObjetivoSesionA_Throws(string? objetivo)
        {
            Assert.Throws<ArgumentException>(() => new Microciclo(
                "mesociclo-1", 1, "Semana 1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7), objetivo!, "Objetivo B"));
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData(null)]
        public void Create_WithEmptyObjetivoSesionB_Throws(string? objetivo)
        {
            Assert.Throws<ArgumentException>(() => new Microciclo(
                "mesociclo-1", 1, "Semana 1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7), "Objetivo A", objetivo!));
        }

        [Fact]
        public void UpdateObjectives_TrimsAndSetsBoth()
        {
            var microciclo = new Microciclo("mesociclo-1", 1, "Semana 1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7), "A", "B");

            microciclo.UpdateObjectives("  Nuevo A  ", "  Nuevo B  ");

            Assert.Equal("Nuevo A", microciclo.ObjetivoSesionA);
            Assert.Equal("Nuevo B", microciclo.ObjetivoSesionB);
        }

        [Fact]
        public void Create_SessionLinksAndHabilidades_StartEmpty()
        {
            var microciclo = new Microciclo("mesociclo-1", 1, "Semana 1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7), "A", "B");

            Assert.Empty(microciclo.SesionAHabilidades);
            Assert.Empty(microciclo.SesionBHabilidades);
            Assert.Empty(microciclo.SubprincipioLinks);
            Assert.Empty(microciclo.SubSubPrincipioLinks);
        }

        [Fact]
        public void UpdateSesionAHabilidades_WithVocabularyValues_Sets()
        {
            var microciclo = new Microciclo("mesociclo-1", 1, "Semana 1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7), "A", "B");

            microciclo.UpdateSesionAHabilidades(new List<string> { "Pase", "Control orientado" });

            Assert.Equal(new List<string> { "Pase", "Control orientado" }, microciclo.SesionAHabilidades);
        }

        [Fact]
        public void UpdateSesionBHabilidades_WithVocabularyValues_Sets()
        {
            var microciclo = new Microciclo("mesociclo-1", 1, "Semana 1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7), "A", "B");

            microciclo.UpdateSesionBHabilidades(new List<string> { "Remate" });

            Assert.Equal(new List<string> { "Remate" }, microciclo.SesionBHabilidades);
        }

        [Fact]
        public void UpdateSesionAHabilidades_WithNonVocabularyValue_Throws()
        {
            var microciclo = new Microciclo("mesociclo-1", 1, "Semana 1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7), "A", "B");

            Assert.Throws<ArgumentException>(() => microciclo.UpdateSesionAHabilidades(new List<string> { "No existe" }));
        }

        [Fact]
        public void UpdateSesionBHabilidades_WithNonVocabularyValue_Throws()
        {
            var microciclo = new Microciclo("mesociclo-1", 1, "Semana 1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7), "A", "B");

            Assert.Throws<ArgumentException>(() => microciclo.UpdateSesionBHabilidades(new List<string> { "No existe" }));
        }

        [Fact]
        public void UpdateSesionAHabilidades_WithNull_ClearsToEmptyList()
        {
            var microciclo = new Microciclo("mesociclo-1", 1, "Semana 1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7), "A", "B");
            microciclo.UpdateSesionAHabilidades(new List<string> { "Pase" });

            microciclo.UpdateSesionAHabilidades(null);

            Assert.Empty(microciclo.SesionAHabilidades);
        }

        [Fact]
        public void ReplaceSubprincipioLinks_ForSessionA_AddsLinksForThatSessionOnly()
        {
            var microciclo = new Microciclo("mesociclo-1", 1, "Semana 1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7), "A", "B");

            microciclo.ReplaceSubprincipioLinks(Microciclo.SessionA, new List<string> { "sub-1", "sub-2" });

            Assert.Equal(2, microciclo.SubprincipioLinks.Count);
            Assert.All(microciclo.SubprincipioLinks, l => Assert.Equal(Microciclo.SessionA, l.Session));
            Assert.All(microciclo.SubprincipioLinks, l => Assert.Equal(microciclo.Id, l.MicrocicloId));
        }

        [Fact]
        public void ReplaceSubprincipioLinks_CalledAgainForSameSession_ReplacesPreviousLinks()
        {
            var microciclo = new Microciclo("mesociclo-1", 1, "Semana 1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7), "A", "B");
            microciclo.ReplaceSubprincipioLinks(Microciclo.SessionA, new List<string> { "sub-1" });

            microciclo.ReplaceSubprincipioLinks(Microciclo.SessionA, new List<string> { "sub-2", "sub-3" });

            Assert.Equal(2, microciclo.SubprincipioLinks.Count);
            Assert.DoesNotContain(microciclo.SubprincipioLinks, l => l.SubprincipioId == "sub-1");
        }

        [Fact]
        public void ReplaceSubprincipioLinks_ForSessionB_DoesNotAffectSessionALinks()
        {
            var microciclo = new Microciclo("mesociclo-1", 1, "Semana 1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7), "A", "B");
            microciclo.ReplaceSubprincipioLinks(Microciclo.SessionA, new List<string> { "sub-1" });

            microciclo.ReplaceSubprincipioLinks(Microciclo.SessionB, new List<string> { "sub-2" });

            Assert.Equal(2, microciclo.SubprincipioLinks.Count);
            Assert.Contains(microciclo.SubprincipioLinks, l => l.Session == Microciclo.SessionA && l.SubprincipioId == "sub-1");
            Assert.Contains(microciclo.SubprincipioLinks, l => l.Session == Microciclo.SessionB && l.SubprincipioId == "sub-2");
        }

        [Fact]
        public void ReplaceSubprincipioLinks_WithEmptyList_RemovesAllLinksForThatSession()
        {
            var microciclo = new Microciclo("mesociclo-1", 1, "Semana 1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7), "A", "B");
            microciclo.ReplaceSubprincipioLinks(Microciclo.SessionA, new List<string> { "sub-1" });

            microciclo.ReplaceSubprincipioLinks(Microciclo.SessionA, new List<string>());

            Assert.Empty(microciclo.SubprincipioLinks);
        }

        [Fact]
        public void ReplaceSubprincipioLinks_WithInvalidSession_Throws()
        {
            var microciclo = new Microciclo("mesociclo-1", 1, "Semana 1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7), "A", "B");

            Assert.Throws<ArgumentException>(() => microciclo.ReplaceSubprincipioLinks("C", new List<string> { "sub-1" }));
        }

        [Fact]
        public void ReplaceSubSubPrincipioLinks_ForSessionA_AddsLinksForThatSessionOnly()
        {
            var microciclo = new Microciclo("mesociclo-1", 1, "Semana 1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7), "A", "B");

            microciclo.ReplaceSubSubPrincipioLinks(Microciclo.SessionA, new List<string> { "subsub-1" });

            var link = Assert.Single(microciclo.SubSubPrincipioLinks);
            Assert.Equal(Microciclo.SessionA, link.Session);
            Assert.Equal("subsub-1", link.SubSubPrincipioId);
        }

        [Fact]
        public void ReplaceSubSubPrincipioLinks_WithInvalidSession_Throws()
        {
            var microciclo = new Microciclo("mesociclo-1", 1, "Semana 1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7), "A", "B");

            Assert.Throws<ArgumentException>(() => microciclo.ReplaceSubSubPrincipioLinks("Z", new List<string> { "subsub-1" }));
        }

        [Fact]
        public void Create_WithoutUpdateZones_GameZoneIdSesionAAndB_DefaultToZero()
        {
            var microciclo = new Microciclo("mesociclo-1", 1, "Semana 1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7), "A", "B");

            Assert.Equal(0, microciclo.GameZoneIdSesionA);
            Assert.Equal(0, microciclo.GameZoneIdSesionB);
        }

        [Fact]
        public void UpdateZones_WithPositiveValues_SetsBothSessions()
        {
            var microciclo = new Microciclo("mesociclo-1", 1, "Semana 1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7), "A", "B");

            microciclo.UpdateZones(2, 3);

            Assert.Equal(2, microciclo.GameZoneIdSesionA);
            Assert.Equal(3, microciclo.GameZoneIdSesionB);
        }

        [Fact]
        public void UpdateZones_AllowsDifferentZonesPerSession()
        {
            // Real-world case from the plan (e.g. Microciclo 5): Sesión A and Sesión B of the
            // same week are frequently trained in different field zones.
            var microciclo = new Microciclo("mesociclo-1", 1, "Semana 5", new DateOnly(2026, 9, 29), new DateOnly(2026, 10, 5), "A", "B");

            microciclo.UpdateZones(2, 3);

            Assert.NotEqual(microciclo.GameZoneIdSesionA, microciclo.GameZoneIdSesionB);
        }

        [Fact]
        public void UpdateZones_WithZeroGameZoneIdSesionA_Throws()
        {
            var microciclo = new Microciclo("mesociclo-1", 1, "Semana 1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7), "A", "B");

            Assert.Throws<ArgumentException>(() => microciclo.UpdateZones(0, 1));
        }

        [Fact]
        public void UpdateZones_WithZeroGameZoneIdSesionB_Throws()
        {
            var microciclo = new Microciclo("mesociclo-1", 1, "Semana 1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7), "A", "B");

            Assert.Throws<ArgumentException>(() => microciclo.UpdateZones(1, 0));
        }

        [Fact]
        public void UpdateZones_CalledAgain_OverwritesPreviousValues()
        {
            var microciclo = new Microciclo("mesociclo-1", 1, "Semana 1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7), "A", "B");
            microciclo.UpdateZones(1, 1);

            microciclo.UpdateZones(4, 2);

            Assert.Equal(4, microciclo.GameZoneIdSesionA);
            Assert.Equal(2, microciclo.GameZoneIdSesionB);
        }
    }
}
