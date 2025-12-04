namespace RFFM.Api.Domain.Services
{
    public class InvitationService : IInvitationService
    {
        public async Task<bool> ValidateCodeAsync(string code, CancellationToken cancellationToken)
        {
            // Simula la validación del código (puedes reemplazar esto con lógica real, como consultar una base de datos)
            var validCodes = new[] { "CODE123", "INVITE456", "PLAYER789" };
            await Task.Delay(500, cancellationToken); // Simula una operación asíncrona
            return validCodes.Contains(code);
        }
    }
}