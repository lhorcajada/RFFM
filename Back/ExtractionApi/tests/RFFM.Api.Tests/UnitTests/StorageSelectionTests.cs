#nullable enable
using System;
using System.Collections.Generic;
using System.IO;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using RFFM.Api.DependencyInjection;
using RFFM.Api.Infrastructure.Storage;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class StorageSelectionTests
    {
        [Fact]
        public void DevelopmentDefaultsToLocalStorage()
        {
            var services = new ServiceCollection();
            var configuration = BuildConfiguration(new Dictionary<string, string?>
            {
                ["ConnectionStrings:CatalogConnection"] = "Host=localhost;Database=rffm;Username=test;Password=test"
            });

            services.AddSingleton(configuration);
            services.AddAppServices(configuration, new TestHostEnvironment(Environments.Development));

            using var provider = services.BuildServiceProvider();
            var storageService = provider.GetRequiredService<IStorageService>();

            Assert.IsType<LocalStorageService>(storageService);
        }

        [Fact]
        public void ProductionUsesSupabaseWhenConfigured()
        {
            var services = new ServiceCollection();
            var configuration = BuildConfiguration(new Dictionary<string, string?>
            {
                ["ConnectionStrings:CatalogConnection"] = "Host=localhost;Database=rffm;Username=test;Password=test",
                ["Storage:UseLocal"] = "false",
                ["SupabaseStorage:Url"] = "https://example.supabase.co",
                ["SupabaseStorage:ServiceKey"] = "service-key"
            });

            services.AddSingleton(configuration);
            services.AddAppServices(configuration, new TestHostEnvironment(Environments.Production));

            using var provider = services.BuildServiceProvider();
            var storageService = provider.GetRequiredService<IStorageService>();

            Assert.IsType<SupabaseStorageService>(storageService);
        }

        [Fact]
        public void ProductionWithoutSupabaseConfigurationFailsFast()
        {
            var services = new ServiceCollection();
            var configuration = BuildConfiguration(new Dictionary<string, string?>
            {
                ["ConnectionStrings:CatalogConnection"] = "Host=localhost;Database=rffm;Username=test;Password=test"
            });

            services.AddSingleton(configuration);
            var exception = Assert.Throws<InvalidOperationException>(() =>
                services.AddAppServices(configuration, new TestHostEnvironment(Environments.Production)));

            Assert.Contains("Supabase storage is required", exception.Message, StringComparison.OrdinalIgnoreCase);
        }

        private static IConfiguration BuildConfiguration(Dictionary<string, string?> values)
        {
            return new ConfigurationBuilder()
                .AddInMemoryCollection(values)
                .Build();
        }

        private sealed class TestHostEnvironment : IHostEnvironment
        {
            public TestHostEnvironment(string environmentName)
            {
                EnvironmentName = environmentName;
                ApplicationName = "RFFM.Api.Tests";
                ContentRootPath = Directory.GetCurrentDirectory();
                ContentRootFileProvider = new NullFileProvider();
            }

            public string EnvironmentName { get; set; }

            public string ApplicationName { get; set; }

            public string ContentRootPath { get; set; }

            public IFileProvider ContentRootFileProvider { get; set; }
        }
    }
}