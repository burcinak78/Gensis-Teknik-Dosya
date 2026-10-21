using GensisTd.Api.Auth;

namespace GensisTd.Api.Tests;

public class LoginThrottleTests
{
    private sealed class ManualClock : TimeProvider
    {
        public DateTimeOffset Now = new(2026, 10, 21, 12, 0, 0, TimeSpan.Zero);
        public override DateTimeOffset GetUtcNow() => Now;
    }

    private readonly ManualClock _clock = new();
    private LoginThrottle NewThrottle() => new(_clock);

    [Fact]
    public void Sixth_attempt_for_same_email_is_refused()
    {
        var t = NewThrottle();
        for (var i = 0; i < LoginThrottle.MaxAttemptsPerEmail; i++)
            Assert.Null(t.TryAcquire("a@x.com", "1.1.1.1"));

        var wait = t.TryAcquire("a@x.com", "1.1.1.1");
        Assert.NotNull(wait);
        Assert.Equal(LoginThrottle.Window, wait);
    }

    [Fact]
    public void Same_email_from_other_ip_is_still_refused()
    {
        var t = NewThrottle();
        for (var i = 0; i < LoginThrottle.MaxAttemptsPerEmail; i++)
            t.TryAcquire("a@x.com", $"1.1.1.{i}");

        Assert.NotNull(t.TryAcquire("a@x.com", "9.9.9.9"));
    }

    [Fact]
    public void One_ip_cannot_spray_many_emails()
    {
        var t = NewThrottle();
        for (var i = 0; i < LoginThrottle.MaxAttemptsPerIp; i++)
            Assert.Null(t.TryAcquire($"u{i}@x.com", "1.1.1.1"));

        Assert.NotNull(t.TryAcquire("fresh@x.com", "1.1.1.1"));
        Assert.Null(t.TryAcquire("fresh@x.com", "2.2.2.2"));
    }

    [Fact]
    public void Refused_ip_does_not_use_up_email_attempts()
    {
        var t = NewThrottle();
        for (var i = 0; i < LoginThrottle.MaxAttemptsPerIp; i++)
            t.TryAcquire($"u{i}@x.com", "1.1.1.1");

        for (var i = 0; i < 10; i++)
            t.TryAcquire("victim@x.com", "1.1.1.1");

        Assert.Null(t.TryAcquire("victim@x.com", "2.2.2.2"));
    }

    [Fact]
    public void Window_expiry_allows_again()
    {
        var t = NewThrottle();
        for (var i = 0; i < LoginThrottle.MaxAttemptsPerEmail; i++)
            t.TryAcquire("a@x.com", "1.1.1.1");

        _clock.Now += TimeSpan.FromMinutes(10);
        Assert.Equal(TimeSpan.FromMinutes(5), t.TryAcquire("a@x.com", "1.1.1.1"));

        _clock.Now += TimeSpan.FromMinutes(5);
        Assert.Null(t.TryAcquire("a@x.com", "1.1.1.1"));
    }

    [Fact]
    public void Success_clears_email_count()
    {
        var t = NewThrottle();
        for (var i = 0; i < LoginThrottle.MaxAttemptsPerEmail; i++)
            t.TryAcquire("a@x.com", "1.1.1.1");

        t.Succeeded("a@x.com", "1.1.1.1");
        Assert.Null(t.TryAcquire("a@x.com", "1.1.1.1"));
    }

    [Fact]
    public void Parallel_attempts_cannot_exceed_limit()
    {
        var t = NewThrottle();
        var allowed = 0;
        Parallel.For(0, 200, i =>
        {
            if (t.TryAcquire("a@x.com", $"10.0.{i / 250}.{i % 250}") is null)
                Interlocked.Increment(ref allowed);
        });
        Assert.Equal(LoginThrottle.MaxAttemptsPerEmail, allowed);
    }
}
