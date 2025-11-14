FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 80

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY . .
RUN dotnet restore src/RFFM.Host/RFFM.Host.csproj
RUN dotnet publish src/RFFM.Host/RFFM.Host.csproj -c Release -o /app/publish /p:PublishTrimmed=false

FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "RFFM.Host.dll"]
