using GensisTd.Api.Data;
using Microsoft.AspNetCore.Authorization;

namespace GensisTd.Api.Auth;

/// <summary>Role policies. Row-level rules (company membership, ownership) are in AccessFilters.</summary>
public static class Policies
{
    public const string Admin = "admin";
    public const string Staff = "staff";
    public const string Office = "office";

    public static void AddGensisPolicies(this AuthorizationBuilder auth)
    {
        auth.AddPolicy(Admin, p => p.RequireRole(Roles(AppRole.Admin)));
        auth.AddPolicy(Staff, p => p.RequireRole(Roles(AppRole.Admin, AppRole.Gensis)));
        auth.AddPolicy(Office, p => p.RequireRole(Roles(AppRole.Admin, AppRole.Gensis, AppRole.Muhasebeci)));
    }

    private static string[] Roles(params AppRole[] roles) => roles.Select(ActorMiddleware.RoleName).ToArray();
}
