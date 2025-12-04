namespace RFFM.Api.Domain.Services
{
    public interface IInvitationService
    {
        Task<bool> ValidateCodeAsync(string code, CancellationToken cancellationToken);
    }
}