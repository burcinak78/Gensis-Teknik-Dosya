using GensisTd.Api.Data.Entities;
using GensisTd.Api.Projects;

namespace GensisTd.Api.Tests;

public class TakipCleanupTests
{
    private static readonly Guid CompanyA = Guid.NewGuid();
    private static readonly Guid CompanyB = Guid.NewGuid();
    private static readonly Project Project = new() { Id = Guid.NewGuid(), CompanyId = CompanyA, TdNo = "TD-26-0001" };

    private static TakipProjeler Row(string? td, Guid? company, bool? posted = null) => new()
    {
        TdNo = td,
        CompanyId = company,
        TakipMuhasebe = posted is null ? null : new TakipMuhasebe { CariyeIslendi = posted.Value },
    };

    private static bool Removable(TakipProjeler row, Project? project = null) =>
        new[] { row }.AsQueryable().Where(TakipCleanup.RemovableFor(project ?? Project)).Any();

    [Fact] public void Same_company_unposted_is_removed() => Assert.True(Removable(Row("TD-26-0001", CompanyA)));
    [Fact] public void Same_company_not_yet_posted_is_removed() => Assert.True(Removable(Row("TD-26-0001", CompanyA, posted: false)));
    [Fact] public void Row_without_company_is_removed() => Assert.True(Removable(Row("TD-26-0001", null)));
    [Fact] public void Posted_row_is_kept() => Assert.False(Removable(Row("TD-26-0001", CompanyA, posted: true)));

    // KRR-013: staff may have moved the takip row to another company; it must survive.
    [Fact] public void Other_company_row_is_kept() => Assert.False(Removable(Row("TD-26-0001", CompanyB)));

    [Fact] public void Other_td_is_kept() => Assert.False(Removable(Row("TD-26-0002", CompanyA)));

    [Fact]
    public void Project_without_td_removes_nothing()
    {
        var noTd = new Project { CompanyId = CompanyA, TdNo = null };
        Assert.False(Removable(Row(null, CompanyA), noTd));
    }
}
