using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Models;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Domain.Services
{
    public class SanctionConvocationEnforcementService : ISanctionConvocationEnforcementService
    {
        private readonly AppDbContext _db;

        public SanctionConvocationEnforcementService(AppDbContext db) => _db = db;

        public async Task<Convocation> ForceDeconvocationAsync(
            string teamPlayerId, string targetEventId, int excuseTypeId, CancellationToken cancellationToken)
        {
            var deconvokeStatusId = ConvocationStatus.FromName("Deconvoke").Id;

            var conv = await _db.Convocations.FirstOrDefaultAsync(
                c => c.TeamPlayerId == teamPlayerId && c.SportEventId == targetEventId, cancellationToken);

            if (conv is not null)
            {
                conv.SetConvocationStatusId(deconvokeStatusId);
                conv.SetExcuseTypeId(excuseTypeId);
                return conv;
            }

            var model = new ConvocationModel
            {
                EventId = targetEventId,
                TeamPlayerId = teamPlayerId,
                AssistanceTypeId = null,
                ConvocationStatusId = deconvokeStatusId,
                ExcuseTypeId = excuseTypeId
            };

            conv = Convocation.Create(model);
            _db.Convocations.Add(conv);
            return conv;
        }

        public async Task<bool> TryRevertForcedDeconvocationAsync(
            string teamPlayerId, string targetEventId, CancellationToken cancellationToken)
        {
            var conv = await _db.Convocations.FirstOrDefaultAsync(
                c => c.TeamPlayerId == teamPlayerId && c.SportEventId == targetEventId, cancellationToken);
            if (conv is null) return false;

            var deconvokeStatusId = ConvocationStatus.FromName("Deconvoke").Id;
            var looksLikeThisServicesDoing =
                conv.ConvocationStatusId == deconvokeStatusId && conv.ExcuseTypeId == ExcuseTypes.SportiveSanction.Id;

            if (!looksLikeThisServicesDoing) return false;

            conv.SetConvocationStatusId(ConvocationStatus.FromName("Pending").Id);
            conv.SetExcuseTypeId(null);
            return true;
        }
    }
}
