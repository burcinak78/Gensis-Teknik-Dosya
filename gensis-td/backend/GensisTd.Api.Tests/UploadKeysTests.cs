using GensisTd.Api.Storage;

namespace GensisTd.Api.Tests;

public class UploadKeysTests
{
    private static readonly Guid Owner = Guid.NewGuid();

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void New_key_round_trips(bool pending)
    {
        var key = UploadKeys.New("musteri", Owner, "sanayi_sicil", "Sicil.PDF", pending);
        Assert.Equal(pending, key.StartsWith(UploadKeys.PendingPrefix));
        Assert.EndsWith(".pdf", key);
        Assert.Equal("sanayi_sicil", UploadKeys.KindOf("musteri", Owner, key, pending));
    }

    [Fact]
    public void Pending_key_is_not_accepted_as_final_and_the_other_way()
    {
        var pending = UploadKeys.New("musteri", Owner, "logo", "a.png", pending: true);
        var final = UploadKeys.New("musteri", Owner, "logo", "a.png", pending: false);
        Assert.Null(UploadKeys.KindOf("musteri", Owner, pending, pending: false));
        Assert.Null(UploadKeys.KindOf("musteri", Owner, final, pending: true));
    }

    [Fact]
    public void Other_owner_or_folder_is_rejected()
    {
        var key = UploadKeys.New("musteri", Guid.NewGuid(), "logo", "a.png", pending: true);
        Assert.Null(UploadKeys.KindOf("musteri", Owner, key, pending: true));
        var engineerKey = UploadKeys.New("muhendis", Owner, "imza", "a.png", pending: true);
        Assert.Null(UploadKeys.KindOf("musteri", Owner, engineerKey, pending: true));
    }

    [Theory]
    [InlineData("pending/musteri/{o}/logo-00000000-0000-0000-0000-000000000000.png/../../x")]
    [InlineData("pending/../musteri/{o}/logo-00000000-0000-0000-0000-000000000000.png")]
    [InlineData("proje/{o}/logo-00000000-0000-0000-0000-000000000000.png")]
    public void Crafted_keys_are_rejected(string template)
    {
        Assert.Null(UploadKeys.KindOf("musteri", Owner, template.Replace("{o}", Owner.ToString()), pending: true));
    }

    [Theory]
    [InlineData("sanayi_sicil", true)]
    [InlineData("ce_b_eki", true)]
    [InlineData("", false)]
    [InlineData("../x", false)]
    [InlineData("Logo", false)]
    [InlineData(null, false)]
    public void Kinds_are_limited(string? kind, bool ok) => Assert.Equal(ok, UploadKeys.IsValidKind(kind));
}
