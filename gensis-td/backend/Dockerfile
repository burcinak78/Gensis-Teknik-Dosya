FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY GensisTd.Api/GensisTd.Api.csproj GensisTd.Api/
RUN dotnet restore GensisTd.Api/GensisTd.Api.csproj
COPY GensisTd.Api/ GensisTd.Api/
RUN dotnet publish GensisTd.Api/GensisTd.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "GensisTd.Api.dll"]
