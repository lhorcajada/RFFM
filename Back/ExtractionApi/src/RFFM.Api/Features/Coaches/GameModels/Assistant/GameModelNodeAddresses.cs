#nullable enable
using System.Collections.Generic;
using System.Linq;
using RFFM.Api.Domain.Aggregates.GameModels;

namespace RFFM.Api.Features.Coaches.GameModels.Assistant
{
    public enum AssistantNodeType { Principio, Subprincipio, Zona, SubSubPrincipio, Habilidad, Nota, SetPieceRule }

    public sealed record NodeAddress(string Address, AssistantNodeType NodeType, string? ParentAddress);

    /// <summary>
    /// Addresses every node of a loaded game model with the same scheme as the front end
    /// (gameModelNodeAddress.ts), so a proposal refers to nodes the read view also addresses.
    /// </summary>
    public static class GameModelNodeAddresses
    {
        private const string SetPiecesAddress = "set-pieces";

        public static IReadOnlyList<NodeAddress> List(GameModel model)
        {
            var nodes = new List<NodeAddress>();

            foreach (var principle in model.Principles)
            {
                nodes.Add(new NodeAddress(principle.Key, AssistantNodeType.Principio, null));
                AddNotas(nodes, model, nota => nota.PrincipioId == principle.Id, principle.Key);

                foreach (var subprincipio in principle.Subprincipios)
                {
                    nodes.Add(new NodeAddress(subprincipio.Key, AssistantNodeType.Subprincipio, principle.Key));
                    AddNotas(nodes, model, nota => nota.SubprincipioId == subprincipio.Id, subprincipio.Key);
                    AddSubSubPrincipios(nodes, model, subprincipio.SubSubPrincipios, subprincipio.Key);

                    foreach (var zona in subprincipio.Zonas)
                    {
                        nodes.Add(new NodeAddress(zona.Key, AssistantNodeType.Zona, subprincipio.Key));
                        AddNotas(nodes, model, nota => nota.ZonaId == zona.Id, zona.Key);
                        AddSubSubPrincipios(nodes, model, zona.SubSubPrincipios, zona.Key);
                    }
                }
            }

            foreach (var rule in model.SetPieceRules)
                nodes.Add(new NodeAddress($"{SetPiecesAddress}/{rule.Id}", AssistantNodeType.SetPieceRule, SetPiecesAddress));

            return nodes;
        }

        private static void AddSubSubPrincipios(List<NodeAddress> nodes, GameModel model, IEnumerable<SubSubPrincipio> subSubPrincipios, string parentAddress)
        {
            foreach (var ssp in subSubPrincipios)
            {
                nodes.Add(new NodeAddress(ssp.Key, AssistantNodeType.SubSubPrincipio, parentAddress));

                foreach (var habilidad in ssp.Habilidades)
                    nodes.Add(new NodeAddress($"{ssp.Key}/hab:{habilidad.Id}", AssistantNodeType.Habilidad, ssp.Key));

                AddNotas(nodes, model, nota => nota.SubSubPrincipioId == ssp.Id, ssp.Key);
            }
        }

        private static void AddNotas(List<NodeAddress> nodes, GameModel model, System.Func<Nota, bool> holdsNota, string parentAddress)
        {
            foreach (var nota in model.Notas.Where(holdsNota))
                nodes.Add(new NodeAddress($"{parentAddress}/nota:{nota.Id}", AssistantNodeType.Nota, parentAddress));
        }
    }
}
