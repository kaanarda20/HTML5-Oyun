using System.Collections.Concurrent;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<ScoreStore>();

var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/api/health", () => Results.Ok(new { status = "ok", game = "Html5OyunBasit" }));

app.MapGet("/api/scores", (ScoreStore store) => Results.Ok(store.GetAll()));

app.MapPost("/api/scores", (ScoreRequest request, ScoreStore store) =>
{
    if (string.IsNullOrWhiteSpace(request.Player))
    {
        return Results.BadRequest(new { message = "Player is required." });
    }

    var score = new ScoreEntry(
        Guid.NewGuid().ToString("N"),
        request.Player.Trim(),
        request.Game.Trim(),
        request.Value,
        DateTimeOffset.UtcNow);

    store.Add(score);
    return Results.Created($"/api/scores/{score.Id}", score);
});

app.Run();

record ScoreRequest(string Player, string Game, int Value);
record ScoreEntry(string Id, string Player, string Game, int Value, DateTimeOffset CreatedAt);

sealed class ScoreStore
{
    private readonly ConcurrentQueue<ScoreEntry> scores = new();

    public void Add(ScoreEntry score)
    {
        scores.Enqueue(score);
        while (scores.Count > 50 && scores.TryDequeue(out _))
        {
        }
    }

    public IReadOnlyCollection<ScoreEntry> GetAll()
    {
        return scores.ToArray();
    }
}
