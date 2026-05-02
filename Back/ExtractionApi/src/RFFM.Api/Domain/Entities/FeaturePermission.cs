namespace RFFM.Api.Domain.Entities
{
    /// <summary>
    /// Controls which roles can access a feature/route and with what permission level.
    /// Seed-defined entries can be overridden at runtime when IsEditable = true.
    /// </summary>
    public class FeaturePermission : BaseEntity
    {
        /// <summary>Human-readable feature name, e.g. "SeasonPrep".</summary>
        public string FeatureName { get; private set; } = null!;

        /// <summary>Front-end route, e.g. "/coach/season-prep".</summary>
        public string FeatureRoute { get; private set; } = null!;

        /// <summary>Identity role name, e.g. "Coach".</summary>
        public string RoleName { get; private set; } = null!;

        /// <summary>1=Read, 2=Write, 3=ReadWrite.</summary>
        public int PermissionTypeId { get; private set; }

        /// <summary>Whether this record can be changed at runtime via admin UI.</summary>
        public bool IsEditable { get; private set; }

        private FeaturePermission() { }

        public FeaturePermission(
            string featureName,
            string featureRoute,
            string roleName,
            PermissionType permissionType,
            bool isEditable = false)
        {
            FeatureName = featureName;
            FeatureRoute = featureRoute;
            RoleName = roleName;
            PermissionTypeId = permissionType.Id;
            IsEditable = isEditable;
        }
    }
}
