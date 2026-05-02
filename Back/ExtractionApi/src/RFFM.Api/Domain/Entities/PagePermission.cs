namespace RFFM.Api.Domain.Entities
{
    /// <summary>
    /// Granular permission for a specific UI element or data subset within a page.
    /// E.g. on the Roster page: Coach can "view_all_ratings", Player can only "view_own_rating".
    /// </summary>
    public class PagePermission : BaseEntity
    {
        /// <summary>Identifies the page, e.g. "Roster".</summary>
        public string PageIdentifier { get; private set; } = null!;

        /// <summary>
        /// Specific permission key within the page, e.g. "view_all_ratings" or "view_own_rating".
        /// </summary>
        public string PermissionKey { get; private set; } = null!;

        /// <summary>Identity role name, e.g. "Coach".</summary>
        public string RoleName { get; private set; } = null!;

        /// <summary>1=Read, 2=Write, 3=ReadWrite.</summary>
        public int PermissionTypeId { get; private set; }

        /// <summary>Whether this record can be changed at runtime via admin UI.</summary>
        public bool IsEditable { get; private set; }

        private PagePermission() { }

        public PagePermission(
            string pageIdentifier,
            string permissionKey,
            string roleName,
            PermissionType permissionType,
            bool isEditable = false)
        {
            PageIdentifier = pageIdentifier;
            PermissionKey = permissionKey;
            RoleName = roleName;
            PermissionTypeId = permissionType.Id;
            IsEditable = isEditable;
        }
    }
}
