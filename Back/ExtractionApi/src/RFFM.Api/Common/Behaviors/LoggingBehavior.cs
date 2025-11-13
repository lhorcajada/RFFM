using Mediator;
using Microsoft.Extensions.Logging;

namespace RFFM.Api.Common.Behaviors;

public class LoggingBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : IRequest<TResponse>
{
    private readonly ILogger<TRequest> _logger;

    public LoggingBehavior(ILogger<TRequest> logger)
    {
        _logger = logger;
    }

    public async ValueTask<TResponse> Handle(TRequest message, MessageHandlerDelegate<TRequest, TResponse> next, CancellationToken cancellationToken)
    {
        _logger.LogInformation($"Handling {typeof(TRequest).Name}");
        var response = await next(message, cancellationToken);
        _logger.LogInformation($"Handled {typeof(TResponse).Name}");

        return response;
    }
}