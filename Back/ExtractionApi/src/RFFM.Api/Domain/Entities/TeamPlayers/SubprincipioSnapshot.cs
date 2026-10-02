namespace RFFM.Api.Domain.Entities.TeamPlayers
{
    /// <summary>Etiquetas del Subprincipio en el momento de valorar, para que la valoración siga
    /// siendo legible aunque el Subprincipio se borre del modelo de juego.</summary>
    public record SubprincipioSnapshot(string Id, string MomentName, string PrincipleLabel, string SubprincipioLabel);
}
