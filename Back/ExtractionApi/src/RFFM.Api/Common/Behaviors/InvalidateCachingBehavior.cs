using EasyCaching.Core;
using Mediator;
using Microsoft.Extensions.Logging;

namespace RFFM.Api.Common.Behaviors;

internal interface IInvalidateCacheRequest
{
   public string PrefixCacheKey { get; }
}

public class InvalidateCachingBehavior<TRequest, TResponse>(
    IEasyCachingProviderFactory cachingFactory,
    ILogger<InvalidateCachingBehavior<TRequest, TResponse>> logger)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull, IRequest<TResponse>
    where TResponse : notnull
{
    private readonly ILogger<InvalidateCachingBehavior<TRequest, TResponse>> _logger = logger;
    private readonly IEasyCachingProvider _cachingProvider = cachingFactory.GetCachingProvider(Cache.CacheDefaultName);

    public async ValueTask<TResponse> Handle(TRequest message, MessageHandlerDelegate<TRequest, TResponse> next, CancellationToken cancellationToken)
    {
        if (message is not IBaseCommand)
        {
            return await next(message, cancellationToken);
        }

        if (message is not IInvalidateCacheRequest cacheRequest)
        {
            return await next(message, cancellationToken);
        }

        var cacheKey = cacheRequest.PrefixCacheKey;
        var response = await next(message, cancellationToken);

        await _cachingProvider.RemoveByPrefixAsync(cacheKey, cancellationToken);

        Console.WriteLine($"Cache data with cacheKey: {cacheKey} removed.");

        return response;
    }
}