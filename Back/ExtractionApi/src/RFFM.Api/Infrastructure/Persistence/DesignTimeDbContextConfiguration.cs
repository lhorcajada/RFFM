using System.Xml.Linq;
using Microsoft.Extensions.Configuration.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace RFFM.Api.Infrastructure.Persistence;

internal static class DesignTimeDbContextConfiguration
{
    public static IConfigurationRoot BuildConfiguration()
    {
        var rootDirectory = FindRepositoryRoot() ?? Directory.GetCurrentDirectory();
        var hostProjectDirectory = Path.Combine(rootDirectory, "src", "RFFM.Host");
        var hostProjectFile = Path.Combine(hostProjectDirectory, "RFFM.Host.csproj");

        var builder = new ConfigurationBuilder()
            .SetBasePath(hostProjectDirectory)
            .AddJsonFile("appsettings.json", optional: true, reloadOnChange: false)
            .AddJsonFile($"appsettings.{GetEnvironmentName()}.json", optional: true, reloadOnChange: false)
            .AddEnvironmentVariables();

        var userSecretsId = ReadUserSecretsId(hostProjectFile);
        var secretsFilePath = ResolveSecretsFilePath(userSecretsId);
        if (!string.IsNullOrWhiteSpace(secretsFilePath) && File.Exists(secretsFilePath))
        {
            builder.AddJsonFile(secretsFilePath, optional: true, reloadOnChange: false);
        }

        return builder.Build();
    }

    public static string ResolveConnectionString(
        IConfiguration configuration,
        string defaultConnectionStringKey,
        string[] args)
    {
        var connectionStringKey = GetCommandLineValue(args, "--connection-string-key")
            ?? defaultConnectionStringKey;

        var connectionString = configuration.GetConnectionString(connectionStringKey)
            ?? configuration[$"{ConnectionStringsSectionName}:{connectionStringKey}"]
            ?? configuration[connectionStringKey];

        if (!string.IsNullOrWhiteSpace(connectionString))
        {
            return connectionString;
        }

        throw new InvalidOperationException(
            $"Connection string '{connectionStringKey}' is required for design-time DbContext creation. " +
            "Set it in secrets.json under ConnectionStrings or as a top-level key, or pass --connection-string-key <name> to the migration command.");
    }

    private const string ConnectionStringsSectionName = "ConnectionStrings";

    private static string? GetEnvironmentName()
    {
        var environment = Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT")
            ?? Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");

        return string.IsNullOrWhiteSpace(environment) ? "Development" : environment;
    }

    private static string? GetCommandLineValue(string[] args, string key)
    {
        for (var index = 0; index < args.Length; index++)
        {
            var current = args[index];
            if (current.Equals(key, StringComparison.OrdinalIgnoreCase) && index + 1 < args.Length)
            {
                return args[index + 1];
            }

            var prefix = key + "=";
            if (current.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            {
                return current.Substring(prefix.Length);
            }
        }

        return null;
    }

    private static string? ReadUserSecretsId(string projectFile)
    {
        if (!File.Exists(projectFile))
        {
            return null;
        }

        try
        {
            var document = XDocument.Load(projectFile);
            var userSecretsId = document.Descendants()
                .FirstOrDefault(element => element.Name.LocalName == "UserSecretsId")
                ?.Value;

            return string.IsNullOrWhiteSpace(userSecretsId) ? null : userSecretsId.Trim();
        }
        catch
        {
            return null;
        }
    }

    private static string? ResolveSecretsFilePath(string? userSecretsId)
    {
        if (string.IsNullOrWhiteSpace(userSecretsId))
        {
            return null;
        }

        var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        if (!string.IsNullOrWhiteSpace(appData))
        {
            var windowsPath = Path.Combine(appData, "Microsoft", "UserSecrets", userSecretsId, "secrets.json");
            if (File.Exists(windowsPath))
            {
                return windowsPath;
            }
        }

        var homePath = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        if (!string.IsNullOrWhiteSpace(homePath))
        {
            var unixPath = Path.Combine(homePath, ".microsoft", "usersecrets", userSecretsId, "secrets.json");
            if (File.Exists(unixPath))
            {
                return unixPath;
            }
        }

        return null;
    }

    private static string? FindRepositoryRoot()
    {
        var searchRoots = new[] { Directory.GetCurrentDirectory(), AppContext.BaseDirectory };

        foreach (var startPath in searchRoots)
        {
            var directory = new DirectoryInfo(startPath);
            while (directory is not null)
            {
                if (File.Exists(Path.Combine(directory.FullName, "src", "RFFM.Host", "RFFM.Host.csproj")))
                {
                    return directory.FullName;
                }

                directory = directory.Parent;
            }
        }

        return null;
    }
}