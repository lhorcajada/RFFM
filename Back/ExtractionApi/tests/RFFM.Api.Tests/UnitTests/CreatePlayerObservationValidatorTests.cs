#nullable enable
using System;
using RFFM.Api.Common;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Features.Coaches.PlayerTracking;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class CreatePlayerObservationValidatorTests
    {
        private static readonly DateOnly Today = DateOnly.FromDateTime(DateTime.UtcNow);

        private static CreatePlayerObservation.Command Valid() => new()
        {
            TeamId = "team-1",
            TeamPlayerId = "tp-1",
            Date = Today,
            SubprincipioId = "sub-1",
            Assessment = "NotAchieved",
            Comment = "Busca siempre el pase vertical"
        };

        private static bool IsValid(CreatePlayerObservation.Command command) =>
            new CreatePlayerObservation.Validator().Validate(command).IsValid;

        [Fact]
        public void Validate_ValidCommand_IsValid()
        {
            Assert.True(IsValid(Valid()));
        }

        [Fact]
        public void Validate_FutureDate_IsInvalid()
        {
            Assert.False(IsValid(Valid() with { Date = Today.AddDays(1) }));
        }

        [Theory]
        [InlineData("")]
        [InlineData("Excellent")]
        public void Validate_UnknownAssessment_IsInvalid(string assessment)
        {
            Assert.False(IsValid(Valid() with { Assessment = assessment }));
        }

        [Fact]
        public void Validate_EmptySubprincipio_IsInvalid()
        {
            Assert.False(IsValid(Valid() with { SubprincipioId = "" }));
        }

        [Fact]
        public void Validate_CommentOver500Chars_IsInvalid()
        {
            Assert.False(IsValid(Valid() with { Comment = new string('a', 501) }));
        }

        [Fact]
        public void Validate_AttitudeWithKnownTrait_IsValid()
        {
            Assert.True(IsValid(Valid() with { Kind = "Attitude", SubprincipioId = null, AttitudeKey = "patience" }));
        }

        [Fact]
        public void Validate_AttitudeWithUnknownTrait_IsInvalid()
        {
            Assert.False(IsValid(Valid() with { Kind = "Attitude", SubprincipioId = null, AttitudeKey = "laziness" }));
        }

        [Fact]
        public void Validate_AttitudeWithSubprincipio_IsInvalid()
        {
            Assert.False(IsValid(Valid() with { Kind = "Attitude", AttitudeKey = "patience" }));
        }

        [Fact]
        public void Validate_GameModelWithAttitudeKey_IsInvalid()
        {
            Assert.False(IsValid(Valid() with { AttitudeKey = "patience" }));
        }

        [Fact]
        public void Validate_UnknownKind_IsInvalid()
        {
            Assert.False(IsValid(Valid() with { Kind = "Physical" }));
        }

        [Fact]
        public void Validate_KindDefaultsToGameModel()
        {
            Assert.Equal("GameModel", new CreatePlayerObservation.Command().Kind);
        }

        [Fact]
        public void Validate_GameModelWithKnownHabilidades_IsValid()
        {
            Assert.True(IsValid(Valid() with { Habilidades = new[] { "Percepción", "Pase" } }));
        }

        [Fact]
        public void Validate_UnknownHabilidad_IsInvalid()
        {
            Assert.False(IsValid(Valid() with { Habilidades = new[] { "Velocidad" } }));
        }

        [Fact]
        public void Validate_MoreThanFiveHabilidades_IsInvalid()
        {
            Assert.False(IsValid(Valid() with { Habilidades = new[] { "Pase", "Regate", "Remate", "Centro", "Despeje", "Marcaje" } }));
        }

        [Fact]
        public void Validate_RepeatedHabilidad_IsInvalid()
        {
            Assert.False(IsValid(Valid() with { Habilidades = new[] { "Pase", "Pase" } }));
        }

        [Fact]
        public void Validate_AttitudeWithHabilidades_IsInvalid()
        {
            Assert.False(IsValid(Valid() with { Kind = "Attitude", SubprincipioId = null, AttitudeKey = "patience", Habilidades = new[] { "Pase" } }));
        }

        [Fact]
        public void Validate_WithoutComment_IsValid()
        {
            Assert.True(IsValid(Valid() with { Comment = null }));
        }

        [Fact]
        public void Command_RequiresGameModelReadWriteAndTeamMembership()
        {
            var command = Valid();

            Assert.IsAssignableFrom<IRequireTeamMembership>(command);
            var permission = Assert.IsAssignableFrom<IRequireFeaturePermission>(command);
            Assert.Equal(CoachFeatureRoutes.GameModel, permission.FeatureRoute);
            Assert.Equal("ReadWrite", permission.RequiredPermission);
        }

        [Fact]
        public void ListQuery_RequiresGameModelReadAndTeamMembership()
        {
            var query = new GetPlayerObservations.Query { TeamId = "team-1", TeamPlayerId = "tp-1" };

            Assert.IsAssignableFrom<IRequireTeamMembership>(query);
            var permission = Assert.IsAssignableFrom<IRequireFeaturePermission>(query);
            Assert.Equal(CoachFeatureRoutes.GameModel, permission.FeatureRoute);
            Assert.Equal("Read", permission.RequiredPermission);
        }
    }
}
