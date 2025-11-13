using ColoredConsole;
using EasyCaching.Core;
using Mediator;
using Microsoft.Extensions.Logging;
using IBaseCommand = RFFM.Api.Common.IBaseCommand;

namespace RFFM.Api.Common.Behaviors;

internal interface IInvalidateCacheRequest
{
   public string PrefixCacheKey { get; }
}

public class InvalidateCachingBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull, IRequest<TResponse>
    where TResponse : notnull
{
    private readonly ILogger<InvalidateCachingBehavior<TRequest, TResponse>> _logger;
    private readonly IEasyCachingProvider _cachingProvider;

    public InvalidateCachingBehavior(IEasyCachingProviderFactory cachingFactory,
        ILogger<InvalidateCachingBehavior<TRequest, TResponse>> logger)
    {
        _logger = logger;
        _cachingProvider = cachingFactory.GetCachingProvider(Cache.CacheDefaultName);
    }

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

        await _cachingProvider.RemoveByPrefixAsync(cacheKey);

        ColorConsole.WriteLine($"Cache data with cacheKey: {cacheKey} removed.".DarkRed());

        return response;
    }
}