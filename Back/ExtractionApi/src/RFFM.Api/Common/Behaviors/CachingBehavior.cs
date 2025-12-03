using EasyCaching.Core;
using Mediator;
using Microsoft.Extensions.Logging;

namespace RFFM.Api.Common.Behaviors;

public static class Cache
{
    public const string CacheDefaultName = "default";
}

public interface ICacheRequest
{
    string CacheKey { get; }
    DateTime? AbsoluteExpirationRelativeToNow { get; } 
}

public class CachingBehavior<TRequest, TResponse>(
    IEasyCachingProviderFactory cachingFactory,
    ILogger<CachingBehavior<TRequest, TResponse>> logger)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : IRequest<TResponse>
    where TResponse : notnull
{
    private readonly ILogger<CachingBehavior<TRequest, TResponse>> _logger = logger;
    private readonly IEasyCachingProvider _cachingProvider = cachingFactory.GetCachingProvider(Cache.CacheDefaultName);
    private readonly int defaultCacheExpirationInHours = 1;

    public async ValueTask<TResponse> Handle(TRequest message, MessageHandlerDelegate<TRequest, TResponse> next, CancellationToken cancellationToken)
    {
        if (message is not IBaseQuery)
        {
            return await next(message, cancellationToken);
        }

        if (message is not ICacheRequest cacheRequest)
        {
            return await next(message, cancellationToken);
        }

        var cacheKey = cacheRequest.CacheKey;
        var cachedResponse = await _cachingProvider.GetAsync<TResponse>(cacheKey, cancellationToken);
        if (cachedResponse.Value != null)
        {
            Console.WriteLine($"Fetch data from cache with cacheKey: {cacheKey}");
            return cachedResponse.Value;
        }

        var response = await next(message, cancellationToken);

        var expirationTime = cacheRequest.AbsoluteExpirationRelativeToNow ??
                             DateTime.Now.AddHours(defaultCacheExpirationInHours);

        await _cachingProvider.SetAsync(cacheKey, response, expirationTime.TimeOfDay, cancellationToken);

        Console.WriteLine($"Set data to cache with  cacheKey: {cacheKey}");

        return response;
    }
}