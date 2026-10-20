using GensisTd.Api.Auth;
using GensisTd.Api.Data;

namespace GensisTd.Api.Tests;

public class ActorTests
{
    private static readonly Guid CompanyA = Guid.NewGuid();

    [Theory]
    [InlineData(AppRole.Admin, true, true, true)]
    [InlineData(AppRole.Gensis, false, true, true)]
    [InlineData(AppRole.Muhasebeci, false, false, true)]
    [InlineData(AppRole.Customer, false, false, false)]
    public void Role_flags_match_supabase_helpers(AppRole role, bool admin, bool staff, bool office)
    {
        var a = new Actor(Guid.NewGuid(), role, null);
        Assert.Equal(admin, a.IsAdmin);
        Assert.Equal(staff, a.IsStaff);
        Assert.Equal(office, a.IsOffice);
    }

    [Fact]
    public void Customer_is_member_only_of_own_company()
    {
        var a = new Actor(Guid.NewGuid(), AppRole.Customer, CompanyA);
        Assert.True(a.CanAccessCompany(CompanyA));
        Assert.False(a.CanAccessCompany(Guid.NewGuid()));
        Assert.False(a.CanAccessCompany(null));
    }

    [Fact]
    public void User_without_company_is_member_of_nothing()
    {
        var a = new Actor(Guid.NewGuid(), AppRole.Customer, null);
        Assert.False(a.IsCompanyMember(null));
        Assert.False(a.CanAccessCompany(null));
    }

    [Fact]
    public void Staff_access_every_company()
    {
        var a = new Actor(Guid.NewGuid(), AppRole.Gensis, null);
        Assert.True(a.CanAccessCompany(CompanyA));
        Assert.True(a.CanAccessCompany(null));
    }

    [Theory]
    [InlineData(AppRole.Admin, "admin")]
    [InlineData(AppRole.Gensis, "gensis")]
    [InlineData(AppRole.Customer, "customer")]
    [InlineData(AppRole.Muhasebeci, "muhasebeci")]
    public void Role_claim_uses_database_label(AppRole role, string label) =>
        Assert.Equal(label, ActorMiddleware.RoleName(role));
}
