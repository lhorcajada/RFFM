#nullable enable
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Hellang.Middleware.ProblemDetails;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using RFFM.Api.DependencyInjection;
using RFFM.Api.Domain;
using Xunit;
using DataAnnotationsValidationException = System.ComponentModel.DataAnnotations.ValidationException;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Regression tests for the ProblemDetails mapping bug described in openspec change
    /// `unified-error-codes-i18n`: ServiceCollectionExtensions.AddCustomProblemDetails() used to map
    /// FluentValidation.ValidationException (via an ambiguous `using FluentValidation;`) instead of the
    /// System.ComponentModel.DataAnnotations.ValidationException actually thrown by ValidationBehavior,
    /// so validation failures fell through to the generic 500 handler instead of returning 400.
    /// These tests exercise the real AddCustomProblemDetails() mapping end-to-end via TestServer.
    /// </summary>
    public class ProblemDetailsMappingTests
    {
        private static async Task<(HttpResponseMessage Response, JsonElement Body)> InvokeAsync(
            Action<IEndpointRouteBuilder> mapEndpoints)
        {
            using var host = new HostBuilder()
                .ConfigureWebHost(webBuilder =>
                {
                    webBuilder
                        .UseTestServer()
                        .ConfigureServices(services =>
                        {
                            services.AddRouting();
                            services.AddMvcCore();
                            services.AddCustomProblemDetails();
                        })
                        .Configure(app =>
                        {
                            app.UseProblemDetails();
                            app.UseRouting();
                            app.UseEndpoints(mapEndpoints);
                        });
                })
                .Build();

            await host.StartAsync();

            var client = host.GetTestClient();
            var response = await client.GetAsync("/test");
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            return (response, body);
        }

        [Fact]
        public async Task ValidationException_ReturnsBadRequestWithValidationFailedCode()
        {
            var (response, body) = await InvokeAsync(endpoints =>
                endpoints.MapGet("/test", (Func<IResult>)(() =>
                    throw new DataAnnotationsValidationException("Name: 'Name' no debe estar vacío."))));

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal(ErrorCodes.ValidationFailed, body.GetProperty("code").GetString());
            Assert.True(body.TryGetProperty("errors", out var errors));
            Assert.True(errors.GetArrayLength() > 0);
            Assert.Equal("Name", errors[0].GetProperty("field").GetString());
        }

        [Fact]
        public async Task ArgumentNullException_ReturnsBadRequestWithMissingRequiredArgumentCode()
        {
            var (response, body) = await InvokeAsync(endpoints =>
                endpoints.MapGet("/test", (Func<IResult>)(() => throw new ArgumentNullException("teamId"))));

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal(ErrorCodes.MissingRequiredArgument, body.GetProperty("code").GetString());
        }

        [Fact]
        public async Task DomainException_ReturnsBadRequestWithItsCode()
        {
            var (response, body) = await InvokeAsync(endpoints =>
                endpoints.MapGet("/test", (Func<IResult>)(() =>
                    throw new DomainException("Ejercicios", "Ejercicio no encontrado.", ErrorCodes.ExerciseNotFound))));

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal(ErrorCodes.ExerciseNotFound, body.GetProperty("code").GetString());
        }
    }
}
