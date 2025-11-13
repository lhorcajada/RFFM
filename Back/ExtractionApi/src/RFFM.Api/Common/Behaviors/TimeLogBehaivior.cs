using System.Diagnostics;
using Mediator;
using Microsoft.Extensions.Logging;

namespace RFFM.Api.Common.Behaviors;

public class TimeLoggingBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : IRequest<TResponse>
{
    private readonly ILogger<TRequest> _logger;

    public TimeLoggingBehavior(ILogger<TRequest> logger)
    {
        _logger = logger;
    }
    

    public async ValueTask<TResponse> Handle(TRequest message, MessageHandlerDelegate<TRequest, TResponse> next, CancellationToken cancellationToken)
    {
        var requestName = message.GetType().Name;
        var requestGuid = Guid.NewGuid().ToString();

        var requestNameWithGuid = $"{requestName} [{requestGuid}]";

        _logger.LogInformation($"[START] {requestNameWithGuid}");
        TResponse response;
        var stopwatch = Stopwatch.StartNew();

        try
        {
            response = await next(message, cancellationToken);
        }
        finally
        {
            stopwatch.Stop();
            _logger.LogInformation(
                $"[END] {requestNameWithGuid}; Execution time={stopwatch.ElapsedMilliseconds}ms");
        }

        return response;
    }
}