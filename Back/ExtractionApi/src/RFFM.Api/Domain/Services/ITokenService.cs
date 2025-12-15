namespace RFFM.Api.Domain.Services
{
    public interface ITokenService
    {
        Task<string> GenerateJwtToken(string tempToken, CancellationToken cancellationToken);
        Task<string> GenerateJwtForUser(string userId, CancellationToken cancellationToken);
    }
}
