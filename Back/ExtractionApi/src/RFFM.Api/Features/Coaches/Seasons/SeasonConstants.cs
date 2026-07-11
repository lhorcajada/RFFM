namespace RFFM.Api.Features.Coaches.Seasons
{
    public class SeasonConstants
    {
        public const string SeasonFeature = "SeasonFeature";
        public const string CachePrefix = SeasonFeature;
        public const string ActiveSeasonCacheKey = CachePrefix + ":active";
        public const string SeasonByIdCacheKeyPrefix = CachePrefix + ":id:";
    }
}
