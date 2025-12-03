using Hellang.Middleware.ProblemDetails;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using RFFM.Api.DependencyInjection;
using RFFM.Host.DependencyInjection;

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
            
            //services.AddScoped<DbConnection>(_ =>
            //{
            //    var connectionString = _configuration.GetConnectionString("SqlServer");
            //    var connection = new SqlConnection(connectionString);
            //    return connection;
            //});
           
            //services.AddDbContext<TodoDbContext>();
            
            //services.AddDbContext<IntegrationEventContext>();
            
            //services.AddDbContext<ReadOnlyTodoDbContext>();

            // Configure CORS to allow requests from Netlify app
            services.AddCors(options =>
            {
                options.AddPolicy("AllowNetlifyApp", policy =>
                {
                    policy.WithOrigins("https://rffm.netlify.app")
                          .AllowAnyHeader()
                          .AllowAnyMethod()
                          .AllowCredentials();
                });
            });

            services.AddOpenApi();

            services.AddHttpClient();

            services.AddHealthChecks()
                .AddCheck("self", () => new HealthCheckResult(HealthStatus.Healthy));
        }

        public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
        {
            if (env.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
                app.UseOpenApi();
            }

            app.UseProblemDetails()
                .UseHttpsRedirection()
                .UseRouting()
                .UseCors("AllowNetlifyApp");

            app.UseEndpoints(endpoints =>
            {
                endpoints.MapFeatures();
                endpoints.MapHealthChecks();
                endpoints.MapControllers();
            });
        }
    }
}
