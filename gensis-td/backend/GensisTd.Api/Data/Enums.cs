using NpgsqlTypes;

namespace GensisTd.Api.Data;

// CLR mirrors of the Postgres enum types. Labels must match the database exactly.

public enum AppRole
{
    [PgName("admin")] Admin,
    [PgName("gensis")] Gensis,
    [PgName("customer")] Customer,
    [PgName("muhasebeci")] Muhasebeci,
}

public enum EngineerDiscipline
{
    [PgName("elektrik")] Elektrik,
    [PgName("makine")] Makine,
    [PgName("elektrik_elektronik")] ElektrikElektronik,
    [PgName("mekatronik")] Mekatronik,
}

public enum FieldSource
{
    [PgName("input")] Input,
    [PgName("company")] Company,
    [PgName("company_module")] CompanyModule,
    [PgName("equipment")] Equipment,
    [PgName("engineer")] Engineer,
    [PgName("capacity")] Capacity,
    [PgName("province")] Province,
    [PgName("district")] District,
    [PgName("static")] Static,
    [PgName("derived")] Derived,
}

public enum FieldTransform
{
    [PgName("none")] None,
    [PgName("upper")] Upper,
    [PgName("lower")] Lower,
    [PgName("title")] Title,
    [PgName("date_tr")] DateTr,
    [PgName("number_tr")] NumberTr,
}

public enum GeneratedKind
{
    [PgName("combined_pdf")] CombinedPdf,
    [PgName("single_pdf")] SinglePdf,
    [PgName("zip")] Zip,
}

public enum ModuleType
{
    [PgName("B_MR")] BMr,
    [PgName("B_MRL")] BMrl,
    [PgName("E")] E,
    [PgName("H")] H,
    [PgName("G")] G,
}

public enum ProjectStatus
{
    [PgName("draft")] Draft,
    [PgName("generating")] Generating,
    [PgName("generated")] Generated,
    [PgName("delivered")] Delivered,
    [PgName("canceled")] Canceled,
}

public enum SubscriptionStatus
{
    [PgName("trialing")] Trialing,
    [PgName("active")] Active,
    [PgName("past_due")] PastDue,
    [PgName("canceled")] Canceled,
}

public enum TemplateFormat
{
    [PgName("html")] Html,
    [PgName("docx")] Docx,
}
