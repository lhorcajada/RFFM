using RFFM.Api.Domain.Aggregates.Assistances;

namespace RFFM.Api.Domain.Services
{
    /// <summary>
    /// Shared enforcement logic for a Deconvocation-type sportive sanction (design.md Decisión 4).
    /// Forces/reverts the convocation-side effect of such a sanction; used by both
    /// SetPlayerSanction.cs (sanction create/update/delete) and UpdateConvocationStatus.Handler
    /// (manual convocation status changes). Never calls SaveChangesAsync — the caller controls the
    /// transaction boundary.
    /// </summary>
    public interface ISanctionConvocationEnforcementService
    {
        /// <summary>
        /// Transitions the existing convocation for teamPlayerId/targetEventId to Deconvoke with
        /// the given excuse, or creates a new Deconvoke convocation if none exists yet.
        /// </summary>
        Task<Convocation> ForceDeconvocationAsync(
            string teamPlayerId, string targetEventId, int excuseTypeId, CancellationToken cancellationToken);

        /// <summary>
        /// Reverts a convocation this service previously forced back to Pending/no-excuse.
        /// No-ops (and returns false) if the convocation's current state doesn't match exactly
        /// what forcing would have produced (Deconvoke + SportiveSanction excuse) — never
        /// clobbers an unrelated manual change.
        /// </summary>
        Task<bool> TryRevertForcedDeconvocationAsync(
            string teamPlayerId, string targetEventId, CancellationToken cancellationToken);
    }
}
