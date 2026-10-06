namespace RFFM.Api.Features.Coaches.Users
{
    public class UserConstants
    {
        public const string UserFeature = "UserFeature";
        public const string CachePrefix = UserFeature;
        public const string AvatarsContainerName = "avatars";

        /// <summary>
        /// Ruta del archivo dentro del bucket de avatares a partir de la URL guardada. Tanto el storage local
        /// (<c>avatars/{ruta}</c>) como Supabase (<c>…/public/avatars/{ruta}</c>) incluyen <c>{bucket}/{ruta}</c>.
        /// </summary>
        public static string? AvatarPathFromUrl(string url)
        {
            var marker = $"{AvatarsContainerName}/";
            var index = url.LastIndexOf(marker, StringComparison.Ordinal);
            if (index < 0)
                return null;

            var path = url[(index + marker.Length)..];
            var queryIndex = path.IndexOf('?');
            return queryIndex >= 0 ? path[..queryIndex] : path;
        }
    }
}
