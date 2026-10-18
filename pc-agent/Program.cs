using System.Net;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;
using HomeDashboardAgent;

// HomeDashboard Agent : capteurs, LED Corsair/ASUS et profils de ventilation du PC,
// exposés en HTTP au seul serveur HomeDashboard (jeton + liste d'IP + pare-feu Windows).

using var mutex = new Mutex(true, @"Global\HomeDashboardAgent", out var first);
if (!first) return; // déjà lancé

Directory.CreateDirectory(Log.Dir);
var configPath = Path.Combine(Log.Dir, "config.json");
var statePath = Path.Combine(Log.Dir, "state.json");
var jsonOpts = new JsonSerializerOptions { WriteIndented = true };

// ---------- Configuration (créée au premier lancement) ----------
JsonObject config;
try { config = JsonNode.Parse(File.ReadAllText(configPath))!.AsObject(); }
catch { config = new JsonObject(); }
if (string.IsNullOrWhiteSpace((string?)config["token"]))
    config["token"] = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
config["port"] ??= 8790;
config["allowedIps"] ??= new JsonArray("192.168.1.24", "127.0.0.1", "::1");
// Pilotage des ventilateurs carte mère : désactivé par défaut (peu fiable sur ASUS PRIME Z590-A)
config["fanControl"] ??= false;
config["fanLabels"] ??= new JsonObject
{
    ["Fan #3"] = "Ventilateur LL (prise 3)",
    ["Fan #4"] = "Ventilateur LL (prise 4)",
    ["Fan #6"] = "Ventilateur LL (prise 6)",
    ["Fan #7"] = "Pompe AIO (capteur)",
};
File.WriteAllText(configPath, config.ToJsonString(jsonOpts));

var token = (string)config["token"]!;
var port = (int)config["port"]!;
var allowed = config["allowedIps"]!.AsArray().Select(x => IPAddress.Parse((string)x!)).ToHashSet();

// ---------- État mémorisé (scène lumineuse, profil ventilateurs) ----------
var state = new AgentState();
try { state = JsonSerializer.Deserialize<AgentState>(File.ReadAllText(statePath)) ?? new AgentState(); } catch { }
void SaveState() { try { File.WriteAllText(statePath, JsonSerializer.Serialize(state, jsonOpts)); } catch { } }

Log.Info($"Démarrage agent v1.1.0, port {port}");

var sensors = new Sensors
{
    ControlEnabled = (bool)config["fanControl"]!,
    Labels = config["fanLabels"]!.AsObject().ToDictionary(kv => kv.Key, kv => (string)kv.Value!),
};
var corsair = new Corsair();
var aura = new Aura();

sensors.Start(state.FanProfile);
await aura.Start();
corsair.OnConnected += () => { if (state.LightMode == "color") ApplyLight(); };
corsair.Start();

void ApplyLight()
{
    var (r, g, b) = ParseColor(state.Color, state.Brightness);
    try { corsair.SetColor(r, g, b); } catch (Exception ex) { Log.Warn($"Corsair : {ex.Message}"); }
    try { aura.SetColor(r, g, b).Wait(5000); } catch (Exception ex) { Log.Warn($"Aura : {ex.InnerException?.Message ?? ex.Message}"); }
}
if (state.LightMode == "color") ApplyLight();

static (byte, byte, byte) ParseColor(string hex, int brightness)
{
    hex = hex.TrimStart('#');
    if (hex.Length != 6) throw new ArgumentException("Couleur invalide");
    var n = Convert.ToInt32(hex, 16);
    var k = Math.Clamp(brightness, 0, 100) / 100.0;
    return ((byte)(((n >> 16) & 255) * k), (byte)(((n >> 8) & 255) * k), (byte)((n & 255) * k));
}

// Boucle capteurs + courbe de ventilation (toutes les 2 s)
var cts = new CancellationTokenSource();
var loop = Task.Run(async () =>
{
    while (!cts.IsCancellationRequested)
    {
        sensors.Tick();
        try { await Task.Delay(2000, cts.Token); } catch { }
    }
});

// ---------- Serveur HTTP ----------
var builder = WebApplication.CreateSlimBuilder();
builder.Logging.ClearProviders();
builder.WebHost.ConfigureKestrel(k => k.Listen(IPAddress.Any, port));
var app = builder.Build();

app.Use(async (ctx, next) =>
{
    var ip = ctx.Connection.RemoteIpAddress;
    if (ip != null && ip.IsIPv4MappedToIPv6) ip = ip.MapToIPv4();
    if (ip == null || !allowed.Contains(ip))
    {
        ctx.Response.StatusCode = 403;
        return;
    }
    var given = ctx.Request.Headers["X-Agent-Token"].ToString();
    if (!CryptographicOperations.FixedTimeEquals(System.Text.Encoding.UTF8.GetBytes(given), System.Text.Encoding.UTF8.GetBytes(token)))
    {
        ctx.Response.StatusCode = 401;
        return;
    }
    await next();
});

app.MapGet("/health", () => Results.Json(new
{
    ok = true,
    version = "1.1.0",
    host = Environment.MachineName,
    sensors = sensors.Ready,
    corsair = corsair.StateText,
    aura = aura.State,
}));

app.MapGet("/status", () => sensors.Snapshot is { } s ? Results.Json(s) : Results.Json(new { message = "capteurs en cours de lecture" }, statusCode: 503));

app.MapGet("/sensors/raw", () => Results.Json(sensors.Raw));

app.MapGet("/lighting", async () => Results.Json(new
{
    mode = state.LightMode,
    color = state.Color,
    brightness = state.Brightness,
    corsair = corsair.Describe(),
    aura = await aura.Describe(),
}));

// { "mode": "auto" } ou { "mode": "color", "color": "#rrggbb", "brightness": 0-100 }
app.MapPost("/lighting", async (HttpRequest req) =>
{
    var body = await JsonNode.ParseAsync(req.Body) as JsonObject;
    var mode = (string?)body?["mode"];
    if (mode == "auto")
    {
        state.LightMode = "auto";
        SaveState();
        corsair.Release();
        await aura.Release();
        return Results.Json(new { ok = true, mode });
    }
    if (mode == "color")
    {
        var color = (string?)body?["color"] ?? state.Color;
        var brightness = (int?)body?["brightness"] ?? state.Brightness;
        try { ParseColor(color, brightness); } catch { return Results.Json(new { message = "Couleur invalide" }, statusCode: 400); }
        state.LightMode = "color"; state.Color = color; state.Brightness = Math.Clamp(brightness, 0, 100);
        SaveState();
        var errors = new List<string>();
        var (r, g, b) = ParseColor(state.Color, state.Brightness);
        try { corsair.SetColor(r, g, b); } catch (Exception ex) { errors.Add($"Corsair : {ex.Message}"); }
        try { await aura.SetColor(r, g, b); }
        catch (Exception ex) when (ex.Message.Contains("aucune LED")) { /* rien de branché sur la carte mère */ }
        catch (Exception ex) { errors.Add($"ASUS : {ex.Message}"); }
        return Results.Json(new { ok = errors.Count < 2, mode, errors });
    }
    return Results.Json(new { message = "mode attendu : auto ou color" }, statusCode: 400);
});

app.MapGet("/fans", () => Results.Json(new
{
    enabled = sensors.ControlEnabled,
    profile = sensors.Profile,
    profiles = new[] { new { id = "auto", label = "Auto (BIOS)" } }
        .Concat(Sensors.Profiles.Select(p => new { id = p.Key, label = p.Value.Label })),
}));

app.MapPost("/fans", async (HttpRequest req) =>
{
    var body = await JsonNode.ParseAsync(req.Body) as JsonObject;
    var profile = (string?)body?["profile"] ?? "";
    try { sensors.SetProfile(profile); }
    catch (InvalidOperationException ex) { return Results.Json(new { message = ex.Message }, statusCode: 409); }
    catch { return Results.Json(new { message = "Profil inconnu" }, statusCode: 400); }
    state.FanProfile = profile;
    SaveState();
    return Results.Json(new { ok = true, profile });
});

void Shutdown()
{
    Log.Info("Arrêt de l'agent");
    cts.Cancel();
    sensors.Dispose();   // ventilateurs rendus au BIOS
    corsair.Dispose();   // LED rendues à iCUE
    aura.Dispose();      // LED rendues à Armoury Crate
}
app.Lifetime.ApplicationStopping.Register(Shutdown);
AppDomain.CurrentDomain.ProcessExit += (_, _) => { if (!cts.IsCancellationRequested) Shutdown(); };

try { await app.RunAsync(); }
catch (Exception ex) { Log.Error("Serveur HTTP", ex); Shutdown(); }

public sealed class AgentState
{
    public string LightMode { get; set; } = "auto";
    public string Color { get; set; } = "#ffffff";
    public int Brightness { get; set; } = 100;
    public string FanProfile { get; set; } = "auto";
}
