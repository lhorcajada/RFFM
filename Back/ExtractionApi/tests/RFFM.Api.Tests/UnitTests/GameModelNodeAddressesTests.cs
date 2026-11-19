#nullable enable
using System.Linq;
using RFFM.Api.Domain.Aggregates.GameModels;
using RFFM.Api.Features.Coaches.GameModels.Assistant;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class GameModelNodeAddressesTests
    {
        private const string PrincipleKey = "defensa-organizada-1";
        private const string SubprincipioKey = "defensa-organizada-1.1";
        private const string ZonaKey = "defensa-organizada-1.1-finalizacion";
        private const string SubSubPrincipioKey = "defensa-organizada-1.1.1";

        private static GameModel BuildModelWithEveryNodeType()
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

            subSubPrincipio.Habilidades.Add(new Habilidad(subSubPrincipio.Id, "Marcaje", "Descripcion", "Entrenable", null));
            model.Notas.Add(new Nota(model.Id, "nota", "Texto", null, null, zona.Id, null));
            model.SetPieceRules.Add(new SetPieceRule(model.Id, "penaltis", "Texto"));

            return model;
        }

        private static NodeAddress Single(System.Collections.Generic.IReadOnlyList<NodeAddress> nodes, string address) =>
            Assert.Single(nodes, n => n.Address == address);

        [Fact]
        public void List_ReturnsPrincipleKeyWithoutParent()
        {
            var nodes = GameModelNodeAddresses.List(BuildModelWithEveryNodeType());

            var principle = Single(nodes, PrincipleKey);
            Assert.Equal(AssistantNodeType.Principio, principle.NodeType);
            Assert.Null(principle.ParentAddress);
        }

        [Fact]
        public void List_ReturnsSubprincipioKeyUnderItsPrinciple()
        {
            var nodes = GameModelNodeAddresses.List(BuildModelWithEveryNodeType());

            var subprincipio = Single(nodes, SubprincipioKey);
            Assert.Equal(AssistantNodeType.Subprincipio, subprincipio.NodeType);
            Assert.Equal(PrincipleKey, subprincipio.ParentAddress);
        }

        [Fact]
        public void List_ReturnsZonaKeyUnderItsSubprincipio()
        {
            var nodes = GameModelNodeAddresses.List(BuildModelWithEveryNodeType());

            var zona = Single(nodes, ZonaKey);
            Assert.Equal(AssistantNodeType.Zona, zona.NodeType);
            Assert.Equal(SubprincipioKey, zona.ParentAddress);
        }

        [Fact]
        public void List_ReturnsSubSubPrincipioKeyUnderItsZona()
        {
            var nodes = GameModelNodeAddresses.List(BuildModelWithEveryNodeType());

            var subSubPrincipio = Single(nodes, SubSubPrincipioKey);
            Assert.Equal(AssistantNodeType.SubSubPrincipio, subSubPrincipio.NodeType);
            Assert.Equal(ZonaKey, subSubPrincipio.ParentAddress);
        }

        [Fact]
        public void List_ReturnsHabilidadAsHabAddressUnderItsSubSubPrincipio()
        {
            var model = BuildModelWithEveryNodeType();
            var habilidad = model.Principles.Single().Subprincipios.Single().Zonas.Single().SubSubPrincipios.Single().Habilidades.Single();

            var nodes = GameModelNodeAddresses.List(model);

            var node = Single(nodes, $"{SubSubPrincipioKey}/hab:{habilidad.Id}");
            Assert.Equal(AssistantNodeType.Habilidad, node.NodeType);
            Assert.Equal(SubSubPrincipioKey, node.ParentAddress);
        }

        [Fact]
        public void List_ReturnsNotaAsNotaAddressUnderItsZona()
        {
            var model = BuildModelWithEveryNodeType();
            var nota = model.Notas.Single();

            var nodes = GameModelNodeAddresses.List(model);

            var node = Single(nodes, $"{ZonaKey}/nota:{nota.Id}");
            Assert.Equal(AssistantNodeType.Nota, node.NodeType);
            Assert.Equal(ZonaKey, node.ParentAddress);
        }

        [Fact]
        public void List_ReturnsSetPieceRuleUnderSetPiecesSection()
        {
            var model = BuildModelWithEveryNodeType();
            var rule = model.SetPieceRules.Single();

            var nodes = GameModelNodeAddresses.List(model);

            var node = Single(nodes, $"set-pieces/{rule.Id}");
            Assert.Equal(AssistantNodeType.SetPieceRule, node.NodeType);
            Assert.Equal("set-pieces", node.ParentAddress);
        }

        [Fact]
        public void List_ListsEachNodeOnceWithUniqueAddresses()
        {
            var nodes = GameModelNodeAddresses.List(BuildModelWithEveryNodeType());

            Assert.Equal(7, nodes.Count);
            Assert.Equal(nodes.Count, nodes.Select(n => n.Address).Distinct().Count());
        }
    }
}
