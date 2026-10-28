using RFFM.Api.Domain.Entities.Federation.Results;

namespace RFFM.Api.Domain.Entities.Teams
{
    /// <summary>
    /// Único punto que decide si un partido cuenta para la quiniela (no aplazado ni suspendido).
    /// La RFFM marca un partido suspendido con <c>Status == "3"</c> (convención ya usada por el front en
    /// <c>isSuspended</c>); para los aplazamientos no hay constancia de un código propio, así que se
    /// detecta por texto en <c>StatusReason</c>/<c>GameSituation</c>. Cambiar solo este predicado cuando
    /// se verifique con datos reales (openspec quiniela-team-pool, D2).
    /// </summary>
    public static class QuinielaMatchValidity
    {
        private const string SuspendedStatus = "3";
        private static readonly string[] InvalidMarkers = ["aplaz", "suspend"];

        public static bool IsValid(string? status, string? statusReason, string? gameSituation)
        {
            var suspended = string.Equals(status?.Trim(), SuspendedStatus, StringComparison.Ordinal);
            return !suspended && !ContainsMarker(statusReason) && !ContainsMarker(gameSituation);
        }

        public static bool IsValid(RffmMatch match) => IsValid(match.Status, match.StatusReason, match.GameSituation);

        private static bool ContainsMarker(string? text) =>
            !string.IsNullOrWhiteSpace(text)
            && InvalidMarkers.Any(marker => text.Contains(marker, StringComparison.OrdinalIgnoreCase));
    }
}
