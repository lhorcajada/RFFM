using System.Net;
using System.Net.Sockets;

namespace RFFM.Api.Features.AiSettings.Services
{
    public enum AiBaseUrlVerdict
    {
        Allowed,
        Invalid,
        NotHttps,
        ForbiddenAddress,
        Unresolvable
    }

    public interface IAiBaseUrlGuard
    {
        Task<AiBaseUrlVerdict> CheckAsync(string? baseUrl, CancellationToken cancellationToken);
    }

    /// <summary>
    /// Protects outgoing provider calls: the base URL must be https and must not resolve to a
    /// private, loopback or link-local address.
    /// </summary>
    public sealed class AiBaseUrlGuard : IAiBaseUrlGuard
    {
        public static bool IsHttpsUrl(string? baseUrl) =>
            Uri.TryCreate(baseUrl, UriKind.Absolute, out var uri)
            && uri.Scheme == Uri.UriSchemeHttps
            && string.IsNullOrEmpty(uri.UserInfo);

        public async Task<AiBaseUrlVerdict> CheckAsync(string? baseUrl, CancellationToken cancellationToken)
        {
            if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out var uri) || !string.IsNullOrEmpty(uri.UserInfo))
                return AiBaseUrlVerdict.Invalid;

            if (uri.Scheme != Uri.UriSchemeHttps)
                return AiBaseUrlVerdict.NotHttps;

            IPAddress[] addresses;
            try
            {
                addresses = await Dns.GetHostAddressesAsync(uri.DnsSafeHost, cancellationToken);
            }
            catch (SocketException)
            {
                return AiBaseUrlVerdict.Unresolvable;
            }

            if (addresses.Length == 0)
                return AiBaseUrlVerdict.Unresolvable;

            return addresses.Any(IsForbiddenAddress) ? AiBaseUrlVerdict.ForbiddenAddress : AiBaseUrlVerdict.Allowed;
        }

        public static bool IsForbiddenAddress(IPAddress address)
        {
            if (address.IsIPv4MappedToIPv6)
                address = address.MapToIPv4();

            if (IPAddress.IsLoopback(address)
                || address.Equals(IPAddress.Any)
                || address.Equals(IPAddress.IPv6Any)
                || address.Equals(IPAddress.IPv6None))
                return true;

            if (address.AddressFamily == AddressFamily.InterNetworkV6)
                return address.IsIPv6LinkLocal
                    || address.IsIPv6SiteLocal
                    || address.IsIPv6UniqueLocal
                    || address.IsIPv6Multicast;

            var bytes = address.GetAddressBytes();
            return bytes[0] == 0
                || bytes[0] == 10
                || (bytes[0] == 100 && bytes[1] >= 64 && bytes[1] <= 127)
                || (bytes[0] == 169 && bytes[1] == 254)
                || (bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31)
                || (bytes[0] == 192 && bytes[1] == 168)
                || bytes[0] >= 224;
        }
    }
}
