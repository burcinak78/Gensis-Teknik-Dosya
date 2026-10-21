using System.Collections.Concurrent;

namespace GensisTd.Api.Auth;

// Brute-force guard for /api/auth/login (KRR-015). NOMA's LB/WAF has no rate limiting, so it lives here.
// Attempts are counted per email and per client IP in a fixed window; a successful login clears the
// email's count and gives back its IP slot. Counting happens before the password check, so parallel
// requests cannot slip past the limit and blocked requests never reach BCrypt.
// In-memory: fine for a single backend instance; counts reset on restart.
public sealed class LoginThrottle(TimeProvider clock)
{
    public const int MaxAttemptsPerEmail = 5;
    // Higher than per email so several people behind one office NAT can still sign in.
    public const int MaxAttemptsPerIp = 20;
    public static readonly TimeSpan Window = TimeSpan.FromMinutes(15);
    private const int SweepThreshold = 10_000;

    private sealed class Bucket(DateTimeOffset start)
    {
        public DateTimeOffset Start = start;
        public int Count;
    }

    private readonly ConcurrentDictionary<string, Bucket> _buckets = new();

    // Reserves an attempt. Returns null when allowed, otherwise how long until the caller may retry.
    public TimeSpan? TryAcquire(string email, string? ip)
    {
        var now = clock.GetUtcNow();
        if (_buckets.Count > SweepThreshold)
            Sweep(now);

        var emailBucket = _buckets.GetOrAdd(EmailKey(email), _ => new Bucket(now));
        var ipBucket = ip is null ? null : _buckets.GetOrAdd(IpKey(ip), _ => new Bucket(now));

        // Both buckets are checked and taken together so a refusal on one does not use up the other.
        lock (emailBucket)
        lock (ipBucket ?? emailBucket)
        {
            Reset(emailBucket, now);
            if (ipBucket is not null)
                Reset(ipBucket, now);

            TimeSpan? wait = null;
            if (emailBucket.Count >= MaxAttemptsPerEmail)
                wait = emailBucket.Start + Window - now;
            if (ipBucket is not null && ipBucket.Count >= MaxAttemptsPerIp)
            {
                var ipWait = ipBucket.Start + Window - now;
                wait = wait is null || ipWait > wait ? ipWait : wait;
            }
            if (wait is not null)
                return wait;

            emailBucket.Count++;
            if (ipBucket is not null)
                ipBucket.Count++;
            return null;
        }
    }

    public void Succeeded(string email, string? ip)
    {
        _buckets.TryRemove(EmailKey(email), out _);
        if (ip is not null && _buckets.TryGetValue(IpKey(ip), out var ipBucket))
            lock (ipBucket)
                ipBucket.Count = Math.Max(0, ipBucket.Count - 1);
    }

    private static void Reset(Bucket b, DateTimeOffset now)
    {
        if (now - b.Start >= Window)
        {
            b.Start = now;
            b.Count = 0;
        }
    }

    private void Sweep(DateTimeOffset now)
    {
        foreach (var (key, b) in _buckets)
            if (now - b.Start >= Window)
                _buckets.TryRemove(key, out _);
    }

    private static string EmailKey(string email) => "e:" + email;
    private static string IpKey(string ip) => "i:" + ip;
}
