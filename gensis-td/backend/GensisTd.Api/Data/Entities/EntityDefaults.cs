namespace GensisTd.Api.Data.Entities;

// Hand-written halves of the scaffolded partial entities (scaffolding skips enum columns and
// overwrites the generated files). Constructors repeat the database defaults for value-type
// columns: AppDbContext.Custom.cs removes those defaults from the EF model so that EF always
// sends the value — otherwise an explicit false/0/first-enum-member would be dropped on insert.

public partial class CertificateFile { public CertificateFile() { IsCurrent = true; Version = 1; } }
public partial class Certificate { public Certificate() { IsActive = true; } }
public partial class Company { public Company() { IsActive = true; } }
public partial class DocumentType { public DocumentType() { IsActive = true; } }
public partial class Engineer { public Engineer() { IsActive = true; } public EngineerDiscipline Discipline { get; set; } }
public partial class EquipmentBrand { public EquipmentBrand() { IsActive = true; } }
public partial class EquipmentModel { public EquipmentModel() { IsActive = true; } }
public partial class GeneratedFile { public GeneratedFile() { Version = 1; } public GeneratedKind Kind { get; set; } }
public partial class LookupValue { public LookupValue() { IsActive = true; } }
public partial class NotifiedBody { public NotifiedBody() { IsActive = true; } }
public partial class Plan { public Plan() { IsActive = true; } }
public partial class TakipCounter { public TakipCounter() { Id = 1; NextNo = 1001; } }
public partial class UsageRecord { public UsageRecord() { Quantity = 1; } }
public partial class CompanyModuleCert { public ModuleType ModuleType { get; set; } }

public partial class DocumentTemplate
{
    public DocumentTemplate() { Format = TemplateFormat.Html; IsCurrent = true; Version = 1; }
    public TemplateFormat Format { get; set; }
}

public partial class Profile
{
    public Profile() { IsActive = true; Role = AppRole.Customer; }
    public AppRole Role { get; set; }
}

public partial class Project
{
    public Project() { Status = ProjectStatus.Draft; }
    public ProjectStatus Status { get; set; }
    public ModuleType? CertificationModule { get; set; }
}

public partial class Subscription
{
    public Subscription() { Status = SubscriptionStatus.Trialing; }
    public SubscriptionStatus Status { get; set; }
}

public partial class TemplateField
{
    public TemplateField() { Transform = FieldTransform.None; }
    public FieldSource Source { get; set; }
    public FieldTransform Transform { get; set; }
}

public partial class VProjectOverview { public ProjectStatus? Status { get; set; } }

// KRR-024: bumped when the password changes or the user is deactivated; sessions carry it and stop working.
public partial class User { public int TokenVersion { get; set; } }
