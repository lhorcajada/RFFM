using FluentValidation;
using Mediator;
using ValidationException = System.ComponentModel.DataAnnotations.ValidationException;

namespace RFFM.Api.Common.Behaviors;

public class ValidationBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse> where TRequest : IRequest<TResponse>
{
    private readonly IEnumerable<IValidator<TRequest>> _validators;

    public ValidationBehavior(IEnumerable<IValidator<TRequest>> validators)
    {
        _validators = validators;
    }

    public async ValueTask<TResponse> Handle(TRequest message, MessageHandlerDelegate<TRequest, TResponse> next, CancellationToken cancellationToken)
    {
        var context = new ValidationContext<TRequest>(message);
        var failures = _validators
            .Select(v => v.Validate(context))
            .SelectMany(result => result.Errors)
            .Where(f => f != null)
            .Distinct()
            .ToArray();

        if (!failures.Any())
            return await next(message, cancellationToken);
        var errorMessage = string.Join("; ", failures.Select(f => $"{f.PropertyName}: {f.ErrorMessage}"));
        throw new ValidationException(errorMessage);

    }
}