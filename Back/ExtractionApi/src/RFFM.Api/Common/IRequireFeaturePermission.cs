using Mediator;

namespace RFFM.Api.Common
{
    /// <summary>
    /// Mark a command or query with this interface to enforce feature-level permission checks
    /// via <see cref="Behaviors.FeaturePermissionBehavior{TRequest,TResponse}"/>.
    /// </summary>
    public interface IRequireFeaturePermission
    {
        /// <summary>Front-end route that maps to the feature, e.g. "/coach/season-prep".</summary>
        string FeatureRoute { get; }

        /// <summary>Minimum permission required: Read, Write or ReadWrite.</summary>
        string RequiredPermission { get; }
    }
}
