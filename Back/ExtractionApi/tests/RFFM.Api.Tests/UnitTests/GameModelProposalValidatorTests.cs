#nullable enable
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using RFFM.Api.Domain.Aggregates.GameModels;
using RFFM.Api.Features.Coaches.GameModels.Assistant;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class GameModelProposalValidatorTests
    {
        private const string PrincipleKey = "defensa-organizada-1";
        private const string SubprincipioKey = "defensa-organizada-1.1";
        private const string ZonaKey = "defensa-organizada-1.1-finalizacion";
        private const string SubSubPrincipioKey = "defensa-organizada-1.1.1";

        private static GameModel BuildModel()
        {
            var model = new GameModel("team-1", "Modelo de prueba", "2025-2026");

            var principle = new GamePrinciple(model.Id, 1, PrincipleKey, 1, "Principio", "Texto");
            model.Principles.Add(principle);

            var subprincipio = new Subprincipio(principle.Id, SubprincipioKey, "1.1", "Subprincipio", "Texto");
            principle.Subprincipios.Add(subprincipio);

            var zona = new Zona(subprincipio.Id, ZonaKey, "finalizacion", null, null, "Texto");
            subprincipio.Zonas.Add(zona);

            var subSubPrincipio = new SubSubPrincipio(SubSubPrincipioKey, "1.1.1", "Rol", "Texto", null, zona.Id);
            zona.SubSubPrincipios.Add(subSubPrincipio);

            return model;
        }

        private static IReadOnlyDictionary<string, JsonElement> Fields(params (string Name, object Value)[] fields) =>
            fields.ToDictionary(f => f.Name, f => JsonSerializer.SerializeToElement(f.Value));

        private static AssistantChange ChangeSubprincipio(string id, string address, string texto) =>
            new(id, AssistantOperation.Change, AssistantNodeType.Subprincipio, address, null, null,
                Fields(("texto", texto)));

        private static AssistantChange AddSubprincipio(string id, string parentAddress, string numero, string titulo, string? parentChangeId = null) =>
            new(id, AssistantOperation.Add, AssistantNodeType.Subprincipio, null,
                parentChangeId is null ? parentAddress : null, parentChangeId,
                Fields(("numero", numero), ("titulo", titulo), ("texto", "Texto")));

        private static AssistantChange AddZona(string id, string? parentAddress, string? parentChangeId) =>
            new(id, AssistantOperation.Add, AssistantNodeType.Zona, null, parentAddress, parentChangeId,
                Fields(("zoneKeysCsv", "finalizacion"), ("texto", "Texto")));

        private static AssistantChange AddHabilidad(string id, string parentAddress, string nombre) =>
            new(id, AssistantOperation.Add, AssistantNodeType.Habilidad, null, parentAddress, null,
                Fields(("nombre", nombre), ("descripcion", "Descripción"), ("entrenable", "Sí")));

        private static AssistantEnvelope Proposal(params AssistantChange[] changes) =>
            new(AssistantReplyKind.Proposal, "Propuesta", changes);

        [Fact]
        public void Validate_DiscardsChangeToAddressMissingFromModel()
        {
            var envelope = Proposal(ChangeSubprincipio("c1", "no-existe", "Nuevo texto"));

            var result = GameModelProposalValidator.Validate(BuildModel(), envelope);

            Assert.Empty(result.Changes);
            Assert.Equal(1, result.DiscardedCount);
        }

        [Fact]
        public void Validate_DiscardsHabilidadNameOutsideVocabulary()
        {
            var envelope = Proposal(AddHabilidad("c1", SubSubPrincipioKey, "Inventado"));

            var result = GameModelProposalValidator.Validate(BuildModel(), envelope);

            Assert.Empty(result.Changes);
            Assert.Equal(1, result.DiscardedCount);
        }

        [Fact]
        public void Validate_KeepsValidChangesAndCountsTwoInvalidOfFive()
        {
            var envelope = Proposal(
                ChangeSubprincipio("c1", SubprincipioKey, "Texto revisado"),
                new AssistantChange("c2", AssistantOperation.Change, AssistantNodeType.Principio, PrincipleKey, null, null,
                    Fields(("texto", "Principio revisado"))),
                new AssistantChange("c3", AssistantOperation.Add, AssistantNodeType.Nota, null, ZonaKey, null,
                    Fields(("tipo", "nota"), ("texto", "Nota"))),
                ChangeSubprincipio("c4", "no-existe", "Descartado"),
                AddHabilidad("c5", SubSubPrincipioKey, "Inventado"));

            var result = GameModelProposalValidator.Validate(BuildModel(), envelope);

            Assert.Equal(3, result.Changes.Count);
            Assert.Equal(2, result.DiscardedCount);
        }

        [Fact]
        public void Validate_KeepsFirstChangeForSameAddressAndCountsTheRest()
        {
            var envelope = Proposal(
                ChangeSubprincipio("c1", SubprincipioKey, "Primero"),
                ChangeSubprincipio("c2", SubprincipioKey, "Segundo"));

            var result = GameModelProposalValidator.Validate(BuildModel(), envelope);

            var kept = Assert.Single(result.Changes);
            Assert.Equal("c1", kept.Id);
            Assert.Equal(1, result.DiscardedCount);
        }

        [Fact]
        public void Validate_KeepsAddWhoseParentChangeIsEarlierAndValid()
        {
            var envelope = Proposal(
                AddSubprincipio("c1", PrincipleKey, "1.2", "Nuevo subprincipio"),
                AddZona("c2", parentAddress: null, parentChangeId: "c1"));

            var result = GameModelProposalValidator.Validate(BuildModel(), envelope);

            Assert.Equal(2, result.Changes.Count);
            Assert.Equal(0, result.DiscardedCount);
        }

        [Fact]
        public void Validate_DiscardsDependentWhenItsParentChangeIsDiscarded()
        {
            var envelope = Proposal(
                AddSubprincipio("c1", PrincipleKey, "1.2", ""),
                AddZona("c2", parentAddress: null, parentChangeId: "c1"));

            var result = GameModelProposalValidator.Validate(BuildModel(), envelope);

            Assert.Empty(result.Changes);
            Assert.Equal(2, result.DiscardedCount);
        }

        [Fact]
        public void Validate_DiscardsDependentThatPointsToALaterChange()
        {
            var envelope = Proposal(
                AddZona("c1", parentAddress: null, parentChangeId: "c2"),
                AddSubprincipio("c2", PrincipleKey, "1.2", "Nuevo subprincipio"));

            var result = GameModelProposalValidator.Validate(BuildModel(), envelope);

            Assert.Single(result.Changes);
            Assert.Equal("c2", result.Changes.Single().Id);
            Assert.Equal(1, result.DiscardedCount);
        }

        [Fact]
        public void Validate_KeepsBothAddsUnderTheSameParentAddress()
        {
            var envelope = Proposal(
                AddSubprincipio("c1", PrincipleKey, "1.2", "Primero"),
                AddSubprincipio("c2", PrincipleKey, "1.3", "Segundo"));

            var result = GameModelProposalValidator.Validate(BuildModel(), envelope);

            Assert.Equal(2, result.Changes.Count);
            Assert.Equal(0, result.DiscardedCount);
        }

        private static AssistantChange AddPrincipio(string id, string titulo) =>
            new(id, AssistantOperation.Add, AssistantNodeType.Principio, null, null, null,
                Fields(("gameMomentId", 1), ("numero", 2), ("titulo", titulo)));

        private static AssistantChange AddSetPieceRule(string id) =>
            new(id, AssistantOperation.Add, AssistantNodeType.SetPieceRule, null, null, null,
                Fields(("subtype", "penaltis"), ("texto", "Texto")));

        private static AssistantChange AddSubSubPrincipio(string id, string? parentAddress, string? parentChangeId) =>
            new(id, AssistantOperation.Add, AssistantNodeType.SubSubPrincipio, null, parentAddress, parentChangeId,
                Fields(("numero", "1.2.1"), ("rol", "Rol"), ("texto", "Texto")));

        private static AssistantChange RemoveNode(string id, AssistantNodeType nodeType, string address) =>
            new(id, AssistantOperation.Remove, nodeType, address, null, null, Fields());

        [Fact]
        public void Validate_KeepsAddOfPrincipio()
        {
            var envelope = Proposal(AddPrincipio("c1", "Nuevo principio"));

            var result = GameModelProposalValidator.Validate(BuildModel(), envelope);

            var kept = Assert.Single(result.Changes);
            Assert.Equal("c1", kept.Id);
            Assert.Equal(0, result.DiscardedCount);
        }

        [Fact]
        public void Validate_KeepsAddOfSetPieceRule()
        {
            var envelope = Proposal(AddSetPieceRule("c1"));

            var result = GameModelProposalValidator.Validate(BuildModel(), envelope);

            var kept = Assert.Single(result.Changes);
            Assert.Equal("c1", kept.Id);
            Assert.Equal(0, result.DiscardedCount);
        }

        [Fact]
        public void Validate_KeepsValidChangeOfExistingNode()
        {
            var envelope = Proposal(ChangeSubprincipio("c1", SubprincipioKey, "Texto revisado"));

            var result = GameModelProposalValidator.Validate(BuildModel(), envelope);

            var kept = Assert.Single(result.Changes);
            Assert.Equal(AssistantOperation.Change, kept.Operation);
            Assert.Equal(0, result.DiscardedCount);
        }

        [Fact]
        public void Validate_KeepsValidRemoveOfExistingNode()
        {
            var envelope = Proposal(RemoveNode("c1", AssistantNodeType.Subprincipio, SubprincipioKey));

            var result = GameModelProposalValidator.Validate(BuildModel(), envelope);

            var kept = Assert.Single(result.Changes);
            Assert.Equal(AssistantOperation.Remove, kept.Operation);
            Assert.Equal(0, result.DiscardedCount);
        }

        [Fact]
        public void Validate_DiscardsChangeAndRemoveWhoseNodeTypeDoesNotMatchTheAddress()
        {
            var envelope = Proposal(
                new AssistantChange("c1", AssistantOperation.Change, AssistantNodeType.Zona, SubprincipioKey, null, null,
                    Fields(("texto", "Texto"))),
                RemoveNode("c2", AssistantNodeType.Principio, SubprincipioKey));

            var result = GameModelProposalValidator.Validate(BuildModel(), envelope);

            Assert.Empty(result.Changes);
            Assert.Equal(2, result.DiscardedCount);
        }

        [Fact]
        public void Validate_DiscardsSecondChangeThatRepeatsAChangeId()
        {
            var envelope = Proposal(
                ChangeSubprincipio("c1", SubprincipioKey, "Primero"),
                new AssistantChange("c1", AssistantOperation.Change, AssistantNodeType.Principio, PrincipleKey, null, null,
                    Fields(("texto", "Segundo"))));

            var result = GameModelProposalValidator.Validate(BuildModel(), envelope);

            var kept = Assert.Single(result.Changes);
            Assert.Equal(SubprincipioKey, kept.Address);
            Assert.Equal(1, result.DiscardedCount);
        }

        [Fact]
        public void Validate_KeepsDependentChainOfThreeAddsWhenFirstIsValid()
        {
            var envelope = Proposal(
                AddSubprincipio("c1", PrincipleKey, "1.2", "Nuevo subprincipio"),
                AddZona("c2", parentAddress: null, parentChangeId: "c1"),
                AddSubSubPrincipio("c3", parentAddress: null, parentChangeId: "c2"));

            var result = GameModelProposalValidator.Validate(BuildModel(), envelope);

            Assert.Equal(new[] { "c1", "c2", "c3" }, result.Changes.Select(c => c.Id));
            Assert.Equal(0, result.DiscardedCount);
        }

        [Fact]
        public void Validate_DiscardsWholeDependentChainOfThreeAddsWhenFirstIsInvalid()
        {
            var envelope = Proposal(
                AddSubprincipio("c1", PrincipleKey, "1.2", ""),
                AddZona("c2", parentAddress: null, parentChangeId: "c1"),
                AddSubSubPrincipio("c3", parentAddress: null, parentChangeId: "c2"));

            var result = GameModelProposalValidator.Validate(BuildModel(), envelope);

            Assert.Empty(result.Changes);
            Assert.Equal(3, result.DiscardedCount);
        }
    }
}
