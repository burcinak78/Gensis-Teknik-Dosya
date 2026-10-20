using GensisTd.Api.Auth;
using GensisTd.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace GensisTd.Api.Tests;

// ToQueryString needs no database connection; it proves the filters translate to SQL.
public class SqlTranslationTests
{
    private static AppDbContext Db() => new(new DbContextOptionsBuilder<AppDbContext>()
        .UseNpgsql("Host=unused", AppDbContext.MapEnums).Options);

    [Fact]
    public void Customer_filter_compares_company_id()
    {
        var sql = Db().Projects.VisibleTo(new Actor(Guid.NewGuid(), AppRole.Customer, Guid.NewGuid())).ToQueryString();
        Assert.Contains("p.company_id = @", sql);
        Assert.DoesNotContain("IS NULL", sql);
    }

    [Fact]
    public void User_without_company_gets_an_empty_query()
    {
        var sql = Db().Projects.VisibleTo(new Actor(Guid.NewGuid(), AppRole.Customer, null)).ToQueryString();
        Assert.Contains("WHERE FALSE", sql);
    }

    [Fact]
    public void Staff_query_has_no_filter()
    {
        var sql = Db().Projects.VisibleTo(new Actor(Guid.NewGuid(), AppRole.Admin, null)).ToQueryString();
        Assert.DoesNotContain("WHERE", sql);
    }

    [Fact]
    public void Download_links_join_through_project()
    {
        var sql = Db().DownloadLinks.VisibleTo(new Actor(Guid.NewGuid(), AppRole.Customer, Guid.NewGuid())).ToQueryString();
        Assert.Contains("projects", sql);
        Assert.Contains("generated_files", sql);
    }

    [Fact]
    public void Name_sorts_use_turkish_collation()
    {
        var sql = Db().Districts.OrderBy(d => EF.Functions.Collate(d.Name, Collations.Turkish)).ToQueryString();
        Assert.Contains("COLLATE \"tr-x-icu\"", sql);
    }
}
