using System.Linq;
using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Mobile.Teams.Queries;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Mobile.Teams.Commands
{
    /// <summary>
    /// Upserts a team's structured rules ("Normas del equipo"): creates the <see cref="TeamRulesSet"/>
    /// if absent, otherwise replaces metadata and the full ordered rule list. Coach/Admin only.
    /// PUT /api/mobile/teams/{teamId}/rules
    /// </summary>
    public class SaveTeamRules : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("api/mobile/teams/{teamId}/rules",
                    async (string teamId, SaveTeamRulesCommand command, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(command with { TeamId = teamId }, cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(SaveTeamRules))
                .WithTags("Mobile")
                .Produces<GetTeamRules.TeamRulesDto>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound);
        }

        // ─── Command ──────────────────────────────────────────────────────────

        public record SaveTeamRulesCommand
            : IRequest<GetTeamRules.TeamRulesDto>, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string TeamId { get; set; } = null!;
            public string Title { get; set; } = null!;
            public string Subtitle { get; set; } = null!;
            public string IntroNote { get; set; } = null!;
            public string? ClosingNote { get; set; }
            public string? ApplicationNote { get; set; }
            public List<SaveTeamRuleRequest> Rules { get; set; } = new();

            public string FeatureRoute => CoachFeatureRoutes.TeamRulesDocument;
            public string RequiredPermission => "ReadWrite";
        }

        public record SaveTeamRuleRequest
        {
            public string? Id { get; set; }
            public string ShortTitle { get; set; } = null!;
            public string? Highlight { get; set; }
            public string ViolationSummary { get; set; } = null!;
            public string ConsequenceSummary { get; set; } = null!;
            public string? LongDescription { get; set; }
            public List<string>? BulletPoints { get; set; }
            public string? ConsequenceDetail { get; set; }
        }

        // ─── Validator ────────────────────────────────────────────────────────

        public class Validator : AbstractValidator<SaveTeamRulesCommand>
        {
            public Validator()
            {
                RuleFor(x => x.Title).NotEmpty().MaximumLength(300);
                RuleFor(x => x.Subtitle).NotEmpty().MaximumLength(300);
                RuleFor(x => x.IntroNote).NotEmpty().MaximumLength(2000);
                RuleFor(x => x.ClosingNote).MaximumLength(2000);
                RuleFor(x => x.ApplicationNote).MaximumLength(2000);
                RuleFor(x => x.Rules).NotEmpty();

                RuleForEach(x => x.Rules).ChildRules(rule =>
                {
                    rule.RuleFor(r => r.ShortTitle).NotEmpty().MaximumLength(300);
                    rule.RuleFor(r => r.Highlight).MaximumLength(300);
                    rule.RuleFor(r => r.ViolationSummary).NotEmpty().MaximumLength(1000);
                    rule.RuleFor(r => r.ConsequenceSummary).NotEmpty().MaximumLength(1000);
                    rule.RuleFor(r => r.LongDescription).MaximumLength(4000);
                    rule.RuleFor(r => r.ConsequenceDetail).MaximumLength(1000);
                });
            }
        }

        // ─── Handler ──────────────────────────────────────────────────────────

        public class Handler(AppDbContext db) : IRequestHandler<SaveTeamRulesCommand, GetTeamRules.TeamRulesDto>
        {
            public async ValueTask<GetTeamRules.TeamRulesDto> Handle(SaveTeamRulesCommand request, CancellationToken cancellationToken)
            {
                var team = await db.Teams
                    .Include(t => t.RulesSet)
                        .ThenInclude(rs => rs!.Rules)
                    .SingleOrDefaultAsync(t => t.Id == request.TeamId, cancellationToken);

                if (team == null)
                    throw new NotFoundException("Equipo no encontrado", "TeamNotFound");

                var ruleInputs = request.Rules.Select(r => new TeamRuleInput(
                    r.Id,
                    r.ShortTitle,
                    r.Highlight,
                    r.ViolationSummary,
                    r.ConsequenceSummary,
                    r.LongDescription,
                    r.BulletPoints,
                    r.ConsequenceDetail));

                var rulesSet = team.RulesSet;
                if (rulesSet == null)
                {
                    rulesSet = TeamRulesSet.Create(
                        request.TeamId, request.Title, request.Subtitle, request.IntroNote, request.ClosingNote, request.ApplicationNote);
                    rulesSet.ReplaceRules(ruleInputs);
                    db.TeamRulesSets.Add(rulesSet);
                }
                else
                {
                    rulesSet.UpdateMetadata(request.Title, request.Subtitle, request.IntroNote, request.ClosingNote, request.ApplicationNote);
                    rulesSet.ReplaceRules(ruleInputs);
                }

                await db.SaveChangesAsync(cancellationToken);

                return GetTeamRules.Handler.Map(rulesSet);
            }
        }
    }
}
