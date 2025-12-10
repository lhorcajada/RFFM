using Hellang.Middleware.ProblemDetails;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using RFFM.Api.DependencyInjection;
using RFFM.Host.DependencyInjection;
using System.Data.Common;
using System.Security.Claims;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.Extensions.Localization;
using Microsoft.AspNetCore.Identity;
using RFFM.Api.Domain.Resources;
using RFFM.Api.Infrastructure.Persistence;
using Microsoft.Extensions.Logging;

namespace RFFM.Host
{
    public class Startup
    {
        private readonly IConfiguration _configuration;

        public Startup(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public void ConfigureServices(IServiceCollection services)
        {
            services.AddAppServices(_configuration);

            // Register a shared DbConnection for AppDbContext / ReadOnlyCatalogDbContext
            var catalogConn = _configuration.GetConnectionString("CatalogConnection");
            if (!string.IsNullOrWhiteSpace(catalogConn))
            {
                services.AddScoped<DbConnection>(_ => new SqlConnection(catalogConn));

                // Register EF DbContexts that depend on the DbConnection
                services.AddDbContext<AppDbContext>();
                services.AddDbContext<ReadOnlyCatalogDbContext>();

                // Register IdentityDbContext using the same connection with retry policy
                services.AddDbContext<IdentityDbContext>(options =>
                    options.UseSqlServer(catalogConn, sqlServerOptions =>
                    {
                        // Habilitar retry automático en caso de fallos transitorios
                        sqlServerOptions.EnableRetryOnFailure(
                            maxRetryCount: 5,
                            maxRetryDelay: TimeSpan.FromSeconds(30),
                            errorNumbersToAdd: null
                        );
                        sqlServerOptions.CommandTimeout(60);
                    }));

                // Identity
                services.AddIdentity<IdentityUser, IdentityRole>()
                    .AddEntityFrameworkStores<IdentityDbContext>()
                    .AddDefaultTokenProviders();

                // Configure Identity options
                services.Configure<IdentityOptions>(options =>
                {
                    options.Password.RequiredLength = 8;
                    options.Password.RequireNonAlphanumeric = true;
                    options.Password.RequireUppercase = true;
                    options.Password.RequireLowercase = true;
                    options.Password.RequireDigit = true;
                    options.User.RequireUniqueEmail = true;
                });

                // JWT Authentication
                services.AddAuthentication(options =>
                {
                    options.DefaultAuthenticateScheme = "JwtBearer";
                    options.DefaultChallengeScheme = "JwtBearer";
                }).AddJwtBearer("JwtBearer", options =>
                {
                    options.TokenValidationParameters = new()
                    {
                        ValidateIssuer = true,
                        ValidateAudience = true,
                        ValidateLifetime = true,
                        ValidateIssuerSigningKey = true,
                        ValidIssuer = _configuration["Jwt:Issuer"],
                        ValidAudience = _configuration["Jwt:Audience"],
                        IssuerSigningKey = new SymmetricSecurityKey(
                            System.Text.Encoding.UTF8.GetBytes(_configuration["Jwt:Key"] ?? string.Empty))
                    };

                    options.Events = new JwtBearerEvents
                    {
                        OnMessageReceived = context =>
                        {
                            var endpoint = context.HttpContext.GetEndpoint();

                            // Log token received for diagnostics
                            var logger = context.HttpContext.RequestServices.GetService<ILogger<Startup>>();
                            if (logger != null)
                            {
                                var incoming = context.Request.Headers["Authorization"].FirstOrDefault();
                                logger.LogDebug("OnMessageReceived - Authorization header: {Header}", incoming);
                                logger.LogDebug("Endpoint metadata: {Endpoint}", endpoint?.Metadata?.GetType().FullName);
                            }

                            if (endpoint?.Metadata?.GetMetadata<Microsoft.AspNetCore.Authorization.AuthorizeAttribute>() == null)
                            {
                                context.Token = null;
                            }

                            return Task.CompletedTask;
                        },
                        OnTokenValidated = context =>
                        {
                            var logger = context.HttpContext.RequestServices.GetService<ILogger<Startup>>();
                            if (logger != null)
                            {
                                var sub = context.Principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                                logger.LogInformation("JWT validated for subject: {Sub}", sub);
                                logger.LogDebug("Claims: {Claims}", string.Join(",", context.Principal?.Claims.Select(c => c.Type + ":" + c.Value) ?? Array.Empty<string>()));
                            }

                            return Task.CompletedTask;
                        },
                        OnAuthenticationFailed = async context =>
                        {
                            var logger = context.HttpContext.RequestServices.GetService<ILogger<Startup>>();
                            logger?.LogWarning(context.Exception, "JWT authentication failed");

                            if (!context.Response.HasStarted)
                            {
                                if (context.Exception is SecurityTokenExpiredException)
                                {
                                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                                    context.Response.ContentType = "application/json";
                                    await context.Response.WriteAsync("Unauthorized: Token expired.");
                                    return;
                                }

                                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                                context.Response.ContentType = "application/json";
                                await context.Response.WriteAsync("Unauthorized: Invalid token.");
                                return;
                            }
                        },
                        OnChallenge = context =>
                        {
                            var logger = context.HttpContext.RequestServices.GetService<ILogger<Startup>>();
                            logger?.LogWarning("OnChallenge invoked: {Error}, {ErrorDescription}", context.Error, context.ErrorDescription);
                            return Task.CompletedTask;
                        }
                    };
                });
            }

            // Configure CORS to allow requests from Netlify app
            services.AddCors(options =>
            {
                options.AddPolicy("AllowNetlifyApp", policy =>
                {
                    var origins = _configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? new[] { "https://rffm.netlify.app" };
                    policy.WithOrigins(origins)
                          .AllowAnyHeader()
                          .AllowAnyMethod()
                          .AllowCredentials()
                          .WithExposedHeaders("WWW-Authenticate");
                });
            });

            services.AddOpenApi();

            services.AddHttpClient();

            services.AddHealthChecks()
                .AddCheck("self", () => new HealthCheckResult(HealthStatus.Healthy));

            // Antiforgery and Localization
            services.AddAntiforgery(options => { options.SuppressXFrameOptionsHeader = true; });
            services.AddLocalization();

            // Configure CodeMessages localization (requires IStringLocalizerFactory)
            try
            {
                var sp = services.BuildServiceProvider();
                var localizerFactory = sp.GetService<IStringLocalizerFactory>();
                if (localizerFactory != null)
                {
                    CodeMessages.Configure(localizerFactory);
                }
            }
            catch
            {
                // ignore if localization not available yet
            }
        }

        public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
        {
            var supportedCultures = new[] { "es", "en" };
            var localizationOptions = new RequestLocalizationOptions()
                .SetDefaultCulture("es")
                .AddSupportedCultures(supportedCultures)
                .AddSupportedUICultures(supportedCultures);

            app.UseRequestLocalization(localizationOptions);

            if (env.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
                app.UseOpenApi();
            }

            app.UseProblemDetails()
                .UseHttpsRedirection()
                .UseRouting()
                .UseCors("AllowNetlifyApp");

            // Authentication / Authorization
            app.UseAuthentication();
            app.UseAuthorization();

            app.UseEndpoints(endpoints =>
            {
                endpoints.MapFeatures();
                endpoints.MapHealthChecks();
                endpoints.MapControllers();
            });
        }
    }
}
