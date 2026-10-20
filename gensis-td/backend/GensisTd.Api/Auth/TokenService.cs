using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using GensisTd.Api.Data.Entities;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace GensisTd.Api.Auth;

public class TokenService(IOptions<AuthOptions> options)
{
    public const string Issuer = "gensis-td";

    public static SymmetricSecurityKey SigningKey(string secret) => new(Encoding.UTF8.GetBytes(secret));

    public (string Token, DateTimeOffset Expires) Issue(User user)
    {
        var o = options.Value;
        var expires = DateTimeOffset.UtcNow.AddHours(o.SessionHours);
        var token = new JwtSecurityToken(
            issuer: Issuer,
            audience: Issuer,
            claims: [new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()), new Claim(JwtRegisteredClaimNames.Email, user.Email)],
            expires: expires.UtcDateTime,
            signingCredentials: new SigningCredentials(SigningKey(o.JwtSecret), SecurityAlgorithms.HmacSha256));
        return (new JwtSecurityTokenHandler().WriteToken(token), expires);
    }
}
