namespace RFFM.Api.Features.Coaches.Clubs
{
    public class ClubConstants
    {
        public const string ClubFeature = "ClubFeature";
        public const string CachePrefix = ClubFeature;
        public const string ClubsContainerName = "clubshields";

        /// <summary>Maximum number of clubs a single user can create (as <c>UserClub.IsCreator</c>), per current payment plan.</summary>
        public const int MaxClubsPerCreator = 3;
    }
}
