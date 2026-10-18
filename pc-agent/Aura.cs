using System.Collections.Concurrent;

namespace HomeDashboardAgent;

// LED de la carte mère ASUS via le SDK Aura officiel (objet COM « aura.sdk.1 »,
// fourni avec Armoury Crate / le service d'éclairage ASUS).
// Les appels COM passent tous par un thread STA dédié.
public sealed class Aura : IDisposable
{
    private readonly BlockingCollection<Action> _queue = new();
    private readonly Thread _thread;
    private dynamic? _sdk;
    private bool _controlling;
    private List<object>? _seen; // appareils vus lors de la dernière prise de contrôle
    public string State { get; private set; } = "non démarré";
    public bool Available => _sdk != null;

    public Aura()
    {
        _thread = new Thread(() =>
        {
            foreach (var job in _queue.GetConsumingEnumerable())
            {
                try { job(); } catch (Exception ex) { Log.Error("Aura : tâche", ex); }
            }
        }) { IsBackground = true, Name = "Aura-STA" };
        _thread.SetApartmentState(ApartmentState.STA);
        _thread.Start();
    }

    private Task<T> Run<T>(Func<T> f)
    {
        var tcs = new TaskCompletionSource<T>();
        _queue.Add(() =>
        {
            try { tcs.SetResult(f()); } catch (Exception ex) { tcs.SetException(ex); }
        });
        return tcs.Task;
    }

    public Task Start() => Run(() =>
    {
        try
        {
            var t = Type.GetTypeFromProgID("aura.sdk.1");
            if (t == null) { State = "SDK Aura non installé"; return 0; }
            _sdk = Activator.CreateInstance(t);
            State = "prêt";
            Log.Info("Aura : SDK chargé");
        }
        catch (Exception ex)
        {
            State = "SDK Aura indisponible";
            Log.Error("Aura : chargement", ex);
        }
        return 0;
    });

    private static dynamic Item(dynamic collection, int i)
    {
        try { return collection[i]; } catch { return collection.Item(i); }
    }

    private IEnumerable<dynamic> EnumerateDevices()
    {
        dynamic devices = _sdk!.Enumerate(0);
        int count = (int)devices.Count;
        for (int i = 0; i < count; i++) yield return Item(devices, i);
    }

    public Task<object> Describe() => Run<object>(() =>
    {
        if (_sdk == null) return new { available = false, state = State, devices = Array.Empty<object>() };
        return new { available = true, state = _seen == null ? "prêt" : (_seen.Count == 0 ? "aucune LED ASUS détectée" : "prêt"), devices = (object?)_seen ?? Array.Empty<object>() };
    });

    // Couleur unie sur toutes les LED Aura (format COM : 0x00BBGGRR)
    public Task SetColor(byte r, byte g, byte b) => Run(() =>
    {
        if (_sdk == null) throw new InvalidOperationException(State);
        if (!_controlling) { _sdk.SwitchMode(); _controlling = true; }
        uint color = (uint)(r | (g << 8) | (b << 16));
        var seen = new List<object>();
        foreach (var d in EnumerateDevices())
        {
            seen.Add(new { name = (string)d.Name, lights = (int)d.Lights.Count });
            dynamic lights = d.Lights;
            int n = (int)lights.Count;
            for (int i = 0; i < n; i++) Item(lights, i).Color = color;
            d.Apply();
        }
        _seen = seen;
        if (seen.Count == 0)
        {
            _sdk.ReleaseControl(0);
            _controlling = false;
            throw new InvalidOperationException("aucune LED ASUS détectée");
        }
        return 0;
    });

    // Rend la main à Armoury Crate / Aura Sync
    public Task Release() => Run(() =>
    {
        if (_sdk != null && _controlling)
        {
            try { _sdk.ReleaseControl(0); } catch (Exception ex) { Log.Error("Aura : retour", ex); }
            _controlling = false;
        }
        return 0;
    });

    public void Dispose()
    {
        try { Release().Wait(3000); } catch { }
        _queue.CompleteAdding();
    }
}
