using GensisTd.Api.Endpoints;

namespace GensisTd.Api.Tests;

public class ProjectFileKeyTests
{
    private static readonly Guid Project = Guid.NewGuid();

    [Fact]
    public void New_key_round_trips_to_its_kind()
    {
        var key = ProjectFileEndpoints.NewKey(Project, "fatura", "Fatura Ekim.PDF");
        Assert.StartsWith($"proje/{Project}/fatura-", key);
        Assert.EndsWith(".pdf", key);
        Assert.Equal("fatura", ProjectFileEndpoints.KindOf(Project, key));
    }

    [Theory]
    [InlineData(null, "bin")]
    [InlineData("noext", "bin")]
    [InlineData("a.d$w#g", "dwg")]
    [InlineData("a.verylongextension", "bin")]
    [InlineData("../../x.pdf", "pdf")]
    public void Extension_is_sanitised(string? fileName, string ext)
    {
        Assert.EndsWith("." + ext, ProjectFileEndpoints.NewKey(Project, "fatura", fileName));
    }

    [Fact]
    public void Key_of_another_project_is_rejected()
    {
        var key = ProjectFileEndpoints.NewKey(Guid.NewGuid(), "fatura", "a.pdf");
        Assert.Null(ProjectFileEndpoints.KindOf(Project, key));
    }

    [Theory]
    [InlineData("proje/{p}/fatura-00000000-0000-0000-0000-000000000000.pdf", "fatura")]
    [InlineData("proje/{p}/bilinmeyen-00000000-0000-0000-0000-000000000000.pdf", null)]
    [InlineData("proje/{p}/fatura-00000000-0000-0000-0000-000000000000.pdf/../../x", null)]
    [InlineData("firma/{p}/fatura-00000000-0000-0000-0000-000000000000.pdf", null)]
    [InlineData("proje/{p}/fatura-x.pdf", null)]
    public void Only_issued_key_shapes_are_accepted(string template, string? kind)
    {
        Assert.Equal(kind, ProjectFileEndpoints.KindOf(Project, template.Replace("{p}", Project.ToString())));
    }
}
