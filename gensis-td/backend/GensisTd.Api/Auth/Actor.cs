using GensisTd.Api.Data;

namespace GensisTd.Api.Auth;

/// <summary>
/// The signed-in user as loaded from <c>profiles</c> on every request (see ActorMiddleware).
/// Mirrors the Supabase helpers is_admin(), is_staff() and is_company_member().
/// </summary>
public sealed record Actor(Guid UserId, AppRole Role, Guid? CompanyId)
{
    public bool IsAdmin => Role == AppRole.Admin;

    /// <summary>admin + gensis (Supabase is_staff()).</summary>
    public bool IsStaff => Role is AppRole.Admin or AppRole.Gensis;

    /// <summary>admin + gensis + muhasebeci: proje takip and muhasebe screens.</summary>
    public bool IsOffice => IsStaff || Role == AppRole.Muhasebeci;

    /// <summary>Supabase is_company_member(): a user without a company is a member of nothing.</summary>
    public bool IsCompanyMember(Guid? companyId) => CompanyId is not null && companyId == CompanyId;

    /// <summary>The usual row rule: staff, or a member of the row's company.</summary>
    public bool CanAccessCompany(Guid? companyId) => IsStaff || IsCompanyMember(companyId);

    // Minimal API parameter binding: endpoints take `Actor actor`; missing actor → 400, but
    // such endpoints also RequireAuthorization, which answers 401 first.
    public static ValueTask<Actor?> BindAsync(HttpContext http) => ValueTask.FromResult(http.GetActor());
}

public static class ActorHttpContextExtensions
{
    public static Actor? GetActor(this HttpContext http) => http.Items[typeof(Actor)] as Actor;
}
