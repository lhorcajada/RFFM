using ColoredConsole;
using EasyCaching.Core;
using Mediator;
using Microsoft.Extensions.Logging;
using IBaseQuery = RFFM.Api.Common.IBaseQuery;

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

public class CachingBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : IRequest<TResponse>
    where TResponse : notnull
{
    private readonly ILogger<CachingBehavior<TRequest, TResponse>> _logger;
    private readonly IEasyCachingProvider _cachingProvider;
    private readonly int defaultCacheExpirationInHours = 1;

    public CachingBehavior(IEasyCachingProviderFactory cachingFactory,
        ILogger<CachingBehavior<TRequest, TResponse>> logger)
    {
        _logger = logger;
        _cachingProvider = cachingFactory.GetCachingProvider(Cache.CacheDefaultName);
    }

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
        var cachedResponse = await _cachingProvider.GetAsync<TResponse>(cacheKey);
        if (cachedResponse.Value != null)
        {
            ColorConsole
                .WriteLine($"Fetch data from cache with cacheKey: {cacheKey}".Yellow());
            return cachedResponse.Value;
        }

        var response = await next(message, cancellationToken);

        var expirationTime = cacheRequest.AbsoluteExpirationRelativeToNow ??
                             DateTime.Now.AddHours(defaultCacheExpirationInHours);

        await _cachingProvider.SetAsync(cacheKey, response, expirationTime.TimeOfDay);

        ColorConsole.WriteLine($"Set data to cache with  cacheKey: {cacheKey}".Green());

        return response;
    }
}