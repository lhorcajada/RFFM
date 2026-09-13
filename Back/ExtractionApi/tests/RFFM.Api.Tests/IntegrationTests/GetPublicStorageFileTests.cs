#nullable enable
using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using RFFM.Api.Features.Infrastructure;
using RFFM.Api.Infrastructure.Storage;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Regression coverage for add-injury-protocol-and-documents-tabs: clicking a PDF attachment
    /// download opened a blank tab because GetPublicStorageFile's local-file content-type switch
    /// didn't recognise ".pdf" and fell back to "application/octet-stream", which the frontend's
    /// blob download couldn't render/save correctly. This endpoint requires no auth
    /// (no .RequireAuthorization() in GetPublicStorageFile.cs), so no test auth handler is needed.
    /// </summary>
    public class GetPublicStorageFileTests
    {
        [Fact]
        public async Task GetPublicStorageFile_ForLocalPdf_ReturnsApplicationPdfContentType()
        {
            var basePath = Path.Combine(Path.GetTempPath(), "rffm-tests-storage", Guid.NewGuid().ToString("N"));
            var bucketDir = Path.Combine(basePath, "injury-protocol-attachments");
            Directory.CreateDirectory(bucketDir);
            var relativePath = "injury-protocol-attachments/sample.pdf";
            var pdfBytes = new byte[] { 0x25, 0x50, 0x44, 0x46 }; // "%PDF"
            await File.WriteAllBytesAsync(Path.Combine(bucketDir, "sample.pdf"), pdfBytes);

            using var host = await StartHostAsync(basePath);
            var client = host.GetTestClient();

            var response = await client.GetAsync($"/api/public/storage?url={Uri.EscapeDataString(relativePath)}");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal("application/pdf", response.Content.Headers.ContentType?.MediaType);
            Assert.Equal(pdfBytes, await response.Content.ReadAsByteArrayAsync());
        }

        private static async Task<IHost> StartHostAsync(string basePath)
        {
            var host = new HostBuilder()
                .ConfigureWebHost(webBuilder =>
                {
                    webBuilder
                        .UseTestServer()
                        .ConfigureServices(services =>
                        {
                            services.AddRouting();
                            services.AddSingleton<IConfiguration>(new ConfigurationBuilder()
                                .AddInMemoryCollection(new Dictionary<string, string?>
                                {
                                    ["LocalStorage:BasePath"] = basePath
                                })
                                .Build());
                            services.AddScoped<IStorageService, LocalStorageService>();
                        })
                        .Configure(app =>
                        {
                            app.UseRouting();
                            app.UseEndpoints(endpoints => new GetPublicStorageFile().AddRoutes(endpoints));
                        });
                })
                .Build();

            await host.StartAsync();
            return host;
        }
    }
}
