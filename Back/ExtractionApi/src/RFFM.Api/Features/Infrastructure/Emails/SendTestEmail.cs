using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Services.Email;

namespace RFFM.Api.Features.Infrastructure.Emails
{
    public class SendTestEmail : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/infra/email/test",
                    async (SendTestEmailRequest request, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var cmd = new SendTestEmailCommand(request.ToEmail, request.Subject, request.TemplateName, request.Placeholders ?? new Dictionary<string,string>());
                        await mediator.Send(cmd, cancellationToken);
                        return Results.Ok(new { message = "Email enqueued" });
                    })
                .WithName(nameof(SendTestEmail))
                .WithTags("Infrastructure")
                .Produces(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest);
        }
    }

    public record SendTestEmailRequest(string ToEmail, string? Subject, string? TemplateName, Dictionary<string,string>? Placeholders);

    public record SendTestEmailCommand(string ToEmail, string? Subject, string? TemplateName, Dictionary<string,string> Placeholders) : IRequest;

    public class SendTestEmailHandler : IRequestHandler<SendTestEmailCommand>
    {
        private readonly EmailService _emailService;

        public SendTestEmailHandler(EmailService emailService)
        {
            _emailService = emailService;
        }

        public async ValueTask<Unit> Handle(SendTestEmailCommand request, CancellationToken cancellationToken)
        {
            var subject = string.IsNullOrWhiteSpace(request.Subject) ? "Test email from Futbol Base" : request.Subject;
            var templateName = string.IsNullOrWhiteSpace(request.TemplateName) ? "PasswordResetTemplate.html" : request.TemplateName;

            await _emailService.SendEmailAsync(request.ToEmail, subject, templateName, request.Placeholders);

            return Unit.Value;
        }
    }
}
