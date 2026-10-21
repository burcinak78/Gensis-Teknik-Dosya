using GensisTd.Api.Auth;
using GensisTd.Api.Data;
using GensisTd.Api.Data.Entities;

namespace GensisTd.Api.Tests;

// Filters run here with LINQ to Objects; the same expressions are translated to SQL by EF.
public class AccessFilterTests
{
    private static readonly Guid CompanyA = Guid.NewGuid();
    private static readonly Guid CompanyB = Guid.NewGuid();

    private static readonly Actor Admin = new(Guid.NewGuid(), AppRole.Admin, null);
    private static readonly Actor Gensis = new(Guid.NewGuid(), AppRole.Gensis, null);
    private static readonly Actor Accountant = new(Guid.NewGuid(), AppRole.Muhasebeci, null);
    private static readonly Actor CustomerA = new(Guid.NewGuid(), AppRole.Customer, CompanyA);
    private static readonly Actor NoCompany = new(Guid.NewGuid(), AppRole.Customer, null);

    private static readonly Project ProjectA = new() { Id = Guid.NewGuid(), CompanyId = CompanyA };
    private static readonly Project ProjectB = new() { Id = Guid.NewGuid(), CompanyId = CompanyB };

    [Fact]
    public void Projects_staff_see_all_customers_see_own_company()
    {
        var projects = new[] { ProjectA, ProjectB }.AsQueryable();
        Assert.Equal(2, projects.VisibleTo(Admin).Count());
        Assert.Equal(2, projects.VisibleTo(Gensis).Count());
        Assert.Equal([ProjectA], projects.VisibleTo(CustomerA).ToArray());
        Assert.Empty(projects.VisibleTo(NoCompany));
    }

    [Fact]
    public void Accountant_is_not_staff_for_company_rows()
    {
        // Supabase is_staff() is admin + gensis only; muhasebeci reaches takip via the Office policy.
        var projects = new[] { ProjectA, ProjectB }.AsQueryable();
        Assert.Empty(projects.VisibleTo(Accountant));
    }

    [Fact]
    public void Rows_without_company_are_hidden_from_users_without_company()
    {
        // The case a naive `x.CompanyId == actor.CompanyId` would leak (null == null).
        var changes = new[]
        {
            new PendingChange { CompanyId = null },
            new PendingChange { CompanyId = CompanyA },
        }.AsQueryable();
        Assert.Empty(changes.VisibleTo(NoCompany));
        Assert.Single(changes.VisibleTo(CustomerA));
        Assert.Equal(2, changes.VisibleTo(Admin).Count());
    }

    [Fact]
    public void Project_children_follow_the_project_company()
    {
        var files = new[]
        {
            new ProjectFile { Project = ProjectA },
            new ProjectFile { Project = ProjectB },
        }.AsQueryable();
        Assert.Single(files.VisibleTo(CustomerA));
        Assert.Equal(2, files.VisibleTo(Gensis).Count());

        var generated = new GeneratedFile { Project = ProjectB };
        var links = new[] { new DownloadLink { GeneratedFile = generated } }.AsQueryable();
        Assert.Empty(links.VisibleTo(CustomerA));
    }

    [Fact]
    public void Profiles_own_only_unless_staff()
    {
        var profiles = new[]
        {
            new Profile { Id = CustomerA.UserId, CompanyId = CompanyA },
            new Profile { Id = Guid.NewGuid(), CompanyId = CompanyA },
        }.AsQueryable();
        Assert.Single(profiles.VisibleTo(CustomerA));
        Assert.Equal(2, profiles.VisibleTo(Admin).Count());
    }

    [Fact]
    public void Notes_are_private_even_from_admin()
    {
        var notes = new[]
        {
            new Notlar { UserId = Admin.UserId },
            new Notlar { UserId = CustomerA.UserId },
        }.AsQueryable();
        Assert.Single(notes.OwnedBy(Admin));
        Assert.Single(notes.OwnedBy(CustomerA));
    }

    [Fact]
    public void Engineer_documents_are_staff_only()
    {
        var docs = new[] { new EngineerDocument() }.AsQueryable();
        Assert.Empty(docs.VisibleTo(CustomerA));
        Assert.Single(docs.VisibleTo(Gensis));
    }

    [Fact]
    public void Companies_customers_see_only_own_company()
    {
        var a = new Company { Id = CompanyA, ShortName = "A" };
        var b = new Company { Id = CompanyB, ShortName = "B" };
        var companies = new[] { a, b }.AsQueryable();
        Assert.Equal(2, companies.VisibleTo(Admin).Count());
        Assert.Equal(2, companies.VisibleTo(Gensis).Count());
        Assert.Equal([a], companies.VisibleTo(CustomerA).ToArray());
        Assert.Empty(companies.VisibleTo(Accountant));
        Assert.Empty(companies.VisibleTo(NoCompany));
    }

    [Fact]
    public void Companies_accountant_reads_all_but_writes_none()
    {
        var a = new Company { Id = CompanyA, ShortName = "A" };
        var b = new Company { Id = CompanyB, ShortName = "B" };
        var companies = new[] { a, b }.AsQueryable();
        Assert.Equal(2, companies.ReadableBy(Accountant).Count());
        Assert.Equal(2, companies.ReadableBy(Gensis).Count());
        Assert.Equal([a], companies.ReadableBy(CustomerA).ToArray());
        Assert.Empty(companies.ReadableBy(NoCompany));
        Assert.Empty(companies.VisibleTo(Accountant));
    }

    [Fact]
    public void Company_module_certs_customers_see_only_own_company()
    {
        var a = new CompanyModuleCert { Id = Guid.NewGuid(), CompanyId = CompanyA };
        var b = new CompanyModuleCert { Id = Guid.NewGuid(), CompanyId = CompanyB };
        var certs = new[] { a, b }.AsQueryable();
        Assert.Equal(2, certs.VisibleTo(Gensis).Count());
        Assert.Equal([a], certs.VisibleTo(CustomerA).ToArray());
        Assert.Empty(certs.VisibleTo(NoCompany));
    }

    [Fact]
    public void Engineers_customers_see_own_and_gensis_engineers()
    {
        var gensisCompany = Guid.NewGuid();
        var own = new Engineer { Id = Guid.NewGuid(), FullName = "Own", CompanyId = CompanyA };
        var other = new Engineer { Id = Guid.NewGuid(), FullName = "Other", CompanyId = CompanyB };
        var gensis = new Engineer { Id = Guid.NewGuid(), FullName = "Gensis", CompanyId = gensisCompany };
        var unassigned = new Engineer { Id = Guid.NewGuid(), FullName = "None", CompanyId = null };
        var engineers = new[] { own, other, gensis, unassigned }.AsQueryable();

        Assert.Equal(4, engineers.ReadableBy(Admin, gensisCompany).Count());
        Assert.Equal(4, engineers.ReadableBy(Accountant, gensisCompany).Count());
        Assert.Equal([own, gensis], engineers.ReadableBy(CustomerA, gensisCompany).ToArray());
        Assert.Empty(engineers.ReadableBy(NoCompany, gensisCompany));
        // No Gensis company found: a null id must not match engineers without a company.
        Assert.Equal([own], engineers.ReadableBy(CustomerA, null).ToArray());
    }
}
