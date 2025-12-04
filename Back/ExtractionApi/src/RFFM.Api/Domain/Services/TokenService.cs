using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using RFFM.Api.Domain.Resources;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Domain.Services
{
    public class TokenService : ITokenService
    {
        private readonly IConfiguration _configuration;
        private readonly IdentityDbContext _applicationDbContext;

        public TokenService(IConfiguration configuration, IdentityDbContext applicationDbContext)
        {
            _configuration = configuration;
            _applicationDbContext = applicationDbContext;
        }

        public async Task<string> GenerateJwtToken(string tempToken, CancellationToken cancellationToken )
        {
            var tempSecret = _configuration["Authentication:FrontendSecret"];
            var backendSecret = _configuration["Jwt:Key"];
            var tokenHandler = new JwtSecurityTokenHandler();
            var validationParameters = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(tempSecret)),
                ValidateIssuer = false,
                ValidateAudience = false,
                ValidateLifetime = false,
                RequireSignedTokens = true
            };

            ClaimsPrincipal principal;
            try
            {
                principal = tokenHandler.ValidateToken(tempToken, validationParameters, out _);
            }
            catch (SecurityTokenException ex)
            {
                throw new DomainException(
                    "Validando token temporal",
                    $"Token inválido o expirado: {ex.Message}",
                    "INVALID_TEMP_TOKEN");
            }

            var username = principal.FindFirst("username")?.Value;
            var password = principal.FindFirst("password")?.Value;

            if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(password))
            {
                throw new DomainException(
                    "Generando token", 
                    CodeMessages.LoginEmptyUserOrPass.Message, 
                    CodeMessages.LoginEmptyUserOrPass.Code);
            }
            var user = await _applicationDbContext.Users
                .FirstOrDefaultAsync(uc => uc.UserName == username, cancellationToken);

            if (user == null)
            {
                throw new DomainException(
                    "Generando token",
                    CodeMessages.LoginUserNotRegistered.Message,
                    CodeMessages.LoginUserNotRegistered.Code);
            }

            if (!VerifyPassword(password, user.PasswordHash))
            {
                throw new DomainException(
                    "Generando token",
                    CodeMessages.LoginErrorUserOrPassword.Message,
                    CodeMessages.LoginErrorUserOrPassword.Code);

            }

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(backendSecret));
            var issuer = _configuration["Jwt:Issuer"];
            var audience = _configuration["Jwt:Audience"];
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
            var jwt = new JwtSecurityToken(
                issuer: issuer,
                audience: audience,
                claims: ClaimService.GetClaims(user),
                expires: DateTime.UtcNow.AddHours(1),
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(jwt);

        }

        private bool VerifyPassword(string password, string passwordHash)
        {
            var passwordHasher = new PasswordHasher<object>();
            var verificationResult = passwordHasher.VerifyHashedPassword(null, passwordHash, password);
            return verificationResult == PasswordVerificationResult.Success;
        }
    }
}
