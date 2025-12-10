using Jose;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using RFFM.Api.Domain.Resources;
using RFFM.Api.Infrastructure.Persistence;
using System.Text;

namespace RFFM.Api.Domain.Services
{
    public class TokenService : ITokenService
    {
        private readonly IConfiguration _configuration;
        private readonly IdentityDbContext _applicationDbContext;
        private readonly ILogger<TokenService> _logger;

        public TokenService(
            IConfiguration configuration, 
            IdentityDbContext applicationDbContext,
            ILogger<TokenService> logger)
        {
            _configuration = configuration;
            _applicationDbContext = applicationDbContext;
            _logger = logger;
        }

        public async Task<string> GenerateJwtToken(string tempToken, CancellationToken cancellationToken)
        {
            var tempSecret = _configuration["Authentication:FrontendSecret"];
            var backendSecret = _configuration["Jwt:Key"];
            
            // Log para debugging (solo en desarrollo)
            _logger.LogDebug("FrontendSecret configured: {HasSecret}", !string.IsNullOrWhiteSpace(tempSecret));
            _logger.LogDebug("FrontendSecret length: {Length}", tempSecret?.Length ?? 0);
            _logger.LogDebug("Token length: {Length}", tempToken?.Length ?? 0);
            
            // Validar que las configuraciones existen
            if (string.IsNullOrWhiteSpace(tempSecret))
            {
                _logger.LogError("Authentication:FrontendSecret is not configured");
                throw new InvalidOperationException("La configuración del servicio no es válida: FrontendSecret no configurado");
            }

            if (string.IsNullOrWhiteSpace(backendSecret))
            {
                _logger.LogError("Jwt:Key is not configured");
                throw new InvalidOperationException("La configuración del servicio no es válida: Jwt:Key no configurado");
            }

            if (string.IsNullOrWhiteSpace(tempToken))
            {
                _logger.LogError("Temporary token is null or empty");
                throw new ArgumentNullException(nameof(tempToken), "El token temporal está vacío");
            }

            // Decodificar y validar el token temporal usando Jose
            Dictionary<string, object> payload;
            try
            {
                _logger.LogInformation("Validating temporary token with Jose-JWT...");
                
                // Convertir el secret a bytes
                var secretBytes = Encoding.UTF8.GetBytes(tempSecret);
                
                // Decodificar el token - Jose automáticamente valida la firma
                var payloadJson = JWT.Decode(tempToken, secretBytes, JwsAlgorithm.HS256);
                
                // Deserializar el payload
                payload = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(payloadJson) 
                    ?? throw new SecurityTokenException("El payload del token está vacío");
                
                _logger.LogInformation("✓ Temporary token validated successfully with Jose-JWT");
                _logger.LogDebug("Payload claims count: {Count}", payload.Count);
            }
            catch (IntegrityException ex)
            {
                _logger.LogError(ex, "❌ Invalid token signature. FrontendSecret mismatch");
                throw new UnauthorizedAccessException(
                    "La firma del token no es válida. El FrontendSecret no coincide entre frontend y backend.", 
                    ex);
            }
            catch (InvalidAlgorithmException ex)
            {
                _logger.LogError(ex, "❌ Invalid token algorithm. Expected HS256");
                throw new UnauthorizedAccessException(
                    "El algoritmo del token no es válido. Debe ser HS256.", 
                    ex);
            }
            catch (Exception ex) when (ex is not UnauthorizedAccessException)
            {
                _logger.LogError(ex, "❌ Failed to decode token");
                throw new SecurityTokenException("El token temporal no tiene un formato válido", ex);
            }

            // Extraer claims del payload
            var username = GetClaimValue(payload, "username") 
                        ?? GetClaimValue(payload, "name")
                        ?? GetClaimValue(payload, "sub");
                        
            var password = GetClaimValue(payload, "password");

            _logger.LogInformation("Token validated for user: {Username}", username);

            if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(password))
            {
                _logger.LogWarning("Token missing username or password claims");
                _logger.LogDebug("Available claims: {Claims}", string.Join(", ", payload.Keys));
                throw new DomainException(
                    "Generando token", 
                    CodeMessages.LoginEmptyUserOrPass.Message, 
                    CodeMessages.LoginEmptyUserOrPass.Code);
            }

            // Buscar usuario en la base de datos
            var user = await _applicationDbContext.Users
                .FirstOrDefaultAsync(uc => uc.UserName == username, cancellationToken);

            if (user == null)
            {
                _logger.LogWarning("User not found: {Username}", username);
                throw new DomainException(
                    "Generando token",
                    CodeMessages.LoginUserNotRegistered.Message,
                    CodeMessages.LoginUserNotRegistered.Code);
            }

            // Verificar contraseña
            if (!VerifyPassword(password, user.PasswordHash ?? throw new InvalidOperationException()))
            {
                _logger.LogWarning("Invalid password for user: {Username}", username);
                throw new DomainException(
                    "Generando token",
                    CodeMessages.LoginErrorUserOrPassword.Message,
                    CodeMessages.LoginErrorUserOrPassword.Code);
            }

            // Generar JWT final usando Jose
            var issuer = _configuration["Jwt:Issuer"];
            var audience = _configuration["Jwt:Audience"];
            
            var claims = new Dictionary<string, object>
            {
                { "sub", user.Id },
                { "username", user.UserName ?? string.Empty },
                { "email", user.Email ?? string.Empty },
                { "iss", issuer ?? string.Empty },
                { "aud", audience ?? string.Empty },
                { "exp", DateTimeOffset.UtcNow.AddHours(1).ToUnixTimeSeconds() },
                { "iat", DateTimeOffset.UtcNow.ToUnixTimeSeconds() }
            };

            // Agregar claims adicionales de Identity
            var additionalClaims = ClaimService.GetClaims(user);
            foreach (var claim in additionalClaims)
            {
                if (!claims.ContainsKey(claim.Type))
                {
                    claims[claim.Type] = claim.Value;
                }
            }

            // Generar token con Jose
            var backendSecretBytes = Encoding.UTF8.GetBytes(backendSecret);
            var token = JWT.Encode(claims, backendSecretBytes, JwsAlgorithm.HS256);
            
            _logger.LogInformation("✓ JWT token generated successfully for user: {Username}", username);
            
            return token;
        }

        private string? GetClaimValue(Dictionary<string, object> payload, string key)
        {
            if (payload.TryGetValue(key, out var value))
            {
                return value?.ToString();
            }
            return null;
        }

        private bool VerifyPassword(string password, string passwordHash)
        {
            try
            {
                var passwordHasher = new PasswordHasher<object>();
                var verificationResult = passwordHasher.VerifyHashedPassword(null!, passwordHash, password);
                return verificationResult == PasswordVerificationResult.Success;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error verifying password");
                return false;
            }
        }
    }
}
