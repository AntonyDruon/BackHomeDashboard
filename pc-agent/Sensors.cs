using LibreHardwareMonitor.Hardware;

namespace HomeDashboardAgent;

// Lecture des capteurs (LibreHardwareMonitor) + profils de ventilation
// des ventilateurs branchés sur la carte mère.
public sealed class Sensors : IDisposable
{
    private readonly object _gate = new();
    private readonly Computer _computer;
    private object? _snapshot;
    private List<object> _raw = new();
    private string _profile = "auto";
    private readonly Dictionary<string, float> _lastDuty = new();
    public bool Ready { get; private set; }

    // Courbes : (température CPU °C, % ventilateur). Interpolation linéaire.
    public static readonly Dictionary<string, (string Label, (float T, float P)[] Curve)> Profiles = new()
    {
        ["silencieux"] = ("Silencieux", new[] { (0f, 35f), (55f, 35f), (70f, 50f), (80f, 75f), (88f, 100f) }),
        ["normal"] = ("Normal", new[] { (0f, 40f), (50f, 40f), (65f, 60f), (75f, 80f), (85f, 100f) }),
        ["performance"] = ("Performance", new[] { (0f, 60f), (50f, 60f), (65f, 85f), (75f, 100f) }),
    };
    private const float MinDuty = 35f;     // jamais en dessous
    private const float PanicTemp = 90f;   // au-delà : 100 %

    public Sensors()
    {
        _computer = new Computer
        {
            IsCpuEnabled = true,
            IsGpuEnabled = true,
            IsMemoryEnabled = true,
            IsMotherboardEnabled = true,
            IsControllerEnabled = true,
            IsStorageEnabled = true,
            IsPsuEnabled = true,
            IsNetworkEnabled = false,
            IsBatteryEnabled = false,
        };
    }

    public void Start(string initialProfile)
    {
        try
        {
            _computer.Open();
            Ready = true;
            Log.Info("Capteurs : LibreHardwareMonitor ouvert");
        }
        catch (Exception ex)
        {
            Log.Error("Ouverture LibreHardwareMonitor impossible", ex);
        }
        _profile = Profiles.ContainsKey(initialProfile) ? initialProfile : "auto";
    }

    public string Profile { get { lock (_gate) return _profile; } }

    public void SetProfile(string profile)
    {
        lock (_gate)
        {
            if (profile != "auto" && !Profiles.ContainsKey(profile)) throw new ArgumentException("Profil inconnu");
            _profile = profile;
            if (profile == "auto") RestoreDefaultFans();
        }
        Log.Info($"Profil ventilateurs : {profile}");
    }

    // Appelé toutes les 2 s par la boucle principale
    public void Tick()
    {
        if (!Ready) return;
        lock (_gate)
        {
            try
            {
                foreach (var hw in _computer.Hardware) UpdateRecursive(hw);
                var all = Flatten().ToList();
                _raw = all.Select(x => (object)new
                {
                    hardware = x.Hw.Name,
                    type = x.Hw.HardwareType.ToString(),
                    sensor = x.S.Name,
                    kind = x.S.SensorType.ToString(),
                    value = Round(x.S.Value),
                }).ToList();
                ApplyFanCurve(all);
                _snapshot = Build(all);
            }
            catch (Exception ex)
            {
                Log.Error("Lecture capteurs", ex);
            }
        }
    }

    public object? Snapshot { get { lock (_gate) return _snapshot; } }
    public List<object> Raw { get { lock (_gate) return _raw; } }

    private static void UpdateRecursive(IHardware hw)
    {
        hw.Update();
        foreach (var sub in hw.SubHardware) UpdateRecursive(sub);
    }

    private IEnumerable<(IHardware Hw, ISensor S)> Flatten()
    {
        foreach (var hw in _computer.Hardware)
        {
            foreach (var s in hw.Sensors) yield return (hw, s);
            foreach (var sub in hw.SubHardware)
                foreach (var s in sub.Sensors) yield return (sub, s);
        }
    }

    private static double? Round(float? v, int digits = 1) => v.HasValue && !float.IsNaN(v.Value) ? Math.Round(v.Value, digits) : null;

    private static float? Find(IEnumerable<(IHardware Hw, ISensor S)> all, Func<IHardware, bool> hw, SensorType type, params string[] names)
    {
        foreach (var n in names)
        {
            var m = all.FirstOrDefault(x => hw(x.Hw) && x.S.SensorType == type &&
                                            x.S.Name.Equals(n, StringComparison.OrdinalIgnoreCase) && x.S.Value.HasValue);
            if (m.S != null) return m.S.Value;
        }
        return null;
    }

    private static bool IsGpu(IHardware h) => h.HardwareType is HardwareType.GpuNvidia or HardwareType.GpuAmd;

    private float? CpuTemp(List<(IHardware Hw, ISensor S)> all)
    {
        bool cpu(IHardware h) => h.HardwareType == HardwareType.Cpu;
        return Find(all, cpu, SensorType.Temperature, "CPU Package", "Core Max", "Core Average")
               ?? all.Where(x => cpu(x.Hw) && x.S.SensorType == SensorType.Temperature && x.S.Value.HasValue)
                     .Select(x => x.S.Value).DefaultIfEmpty(null).Max();
    }

    private object Build(List<(IHardware Hw, ISensor S)> all)
    {
        bool cpu(IHardware h) => h.HardwareType == HardwareType.Cpu;
        bool mem(IHardware h) => h.HardwareType == HardwareType.Memory && !h.Name.Contains("Virtual", StringComparison.OrdinalIgnoreCase);
        var cpuHw = _computer.Hardware.FirstOrDefault(h => h.HardwareType == HardwareType.Cpu);
        var gpuHw = _computer.Hardware.FirstOrDefault(IsGpu);

        var coreClocks = all.Where(x => cpu(x.Hw) && x.S.SensorType == SensorType.Clock &&
                                        x.S.Name.StartsWith("Core #") && x.S.Value.HasValue)
                            .Select(x => x.S.Value!.Value).ToList();

        var memUsed = Find(all, mem, SensorType.Data, "Memory Used");
        var memAvail = Find(all, mem, SensorType.Data, "Memory Available");

        var storage = _computer.Hardware.Where(h => h.HardwareType == HardwareType.Storage).Select(h => new
        {
            name = h.Name,
            temp = Round(h.Sensors.FirstOrDefault(s => s.SensorType == SensorType.Temperature && s.Value.HasValue)?.Value),
            usedPercent = Round(h.Sensors.FirstOrDefault(s => s.SensorType == SensorType.Load && s.Name == "Used Space")?.Value, 0),
        }).ToList();

        // Carte mère (Super I/O) : températures et ventilateurs
        var board = all.Where(x => x.Hw.HardwareType == HardwareType.SuperIO).ToList();
        var boardTemps = board.Where(x => x.S.SensorType == SensorType.Temperature && x.S.Value is > 0 and < 120)
                              .Select(x => new { name = x.S.Name, value = Round(x.S.Value) }).ToList();
        var fans = board.Where(x => x.S.SensorType == SensorType.Fan).Select(x =>
        {
            var ctrl = board.FirstOrDefault(c => c.S.SensorType == SensorType.Control && c.S.Index == x.S.Index).S;
            return new
            {
                id = $"mb-{x.S.Index}",
                name = x.S.Name,
                rpm = Round(x.S.Value, 0),
                percent = Round(ctrl?.Value, 0),
                controllable = ctrl?.Control != null && x.S.Value is > 0 && !IsPump(x.S.Name),
            };
        }).Where(f => f.rpm is > 0).ToList();

        // Autres refroidissements vus par LibreHardwareMonitor (AIO, contrôleurs)
        var coolers = _computer.Hardware.Where(h => h.HardwareType is HardwareType.Cooler or HardwareType.EmbeddedController)
            .Select(h => new
            {
                name = h.Name,
                sensors = h.Sensors.Where(s => s.Value.HasValue && s.SensorType is SensorType.Temperature or SensorType.Fan or SensorType.Control or SensorType.Flow)
                                   .Select(s => new { name = s.Name, kind = s.SensorType.ToString(), value = Round(s.Value) }).ToList(),
            }).Where(c => c.sensors.Count > 0).ToList();

        return new
        {
            host = Environment.MachineName,
            time = DateTimeOffset.Now,
            uptimeSeconds = (long)(Environment.TickCount64 / 1000),
            cpu = new
            {
                name = cpuHw?.Name,
                temp = Round(CpuTemp(all)),
                tempMax = Round(Find(all, cpu, SensorType.Temperature, "Core Max")),
                load = Round(Find(all, cpu, SensorType.Load, "CPU Total"), 0),
                power = Round(Find(all, cpu, SensorType.Power, "CPU Package")),
                clock = coreClocks.Count > 0 ? Math.Round(coreClocks.Average()) : (double?)null,
            },
            gpu = gpuHw == null ? null : new
            {
                name = gpuHw.Name,
                temp = Round(Find(all, IsGpu, SensorType.Temperature, "GPU Core")),
                hotspot = Round(Find(all, IsGpu, SensorType.Temperature, "GPU Hot Spot")),
                memoryTemp = Round(Find(all, IsGpu, SensorType.Temperature, "GPU Memory Junction")),
                load = Round(Find(all, IsGpu, SensorType.Load, "GPU Core"), 0),
                power = Round(Find(all, IsGpu, SensorType.Power, "GPU Package", "GPU Power")),
                clock = Round(Find(all, IsGpu, SensorType.Clock, "GPU Core"), 0),
                fanPercent = Round(Find(all, IsGpu, SensorType.Control, "GPU Fan", "GPU Fan 1"), 0),
                fanRpm = Round(Find(all, IsGpu, SensorType.Fan, "GPU Fan", "GPU Fan 1"), 0),
                vramUsedMb = Round(Find(all, IsGpu, SensorType.SmallData, "GPU Memory Used"), 0),
                vramTotalMb = Round(Find(all, IsGpu, SensorType.SmallData, "GPU Memory Total"), 0),
            },
            memory = new
            {
                usedGb = Round(memUsed),
                totalGb = memUsed.HasValue && memAvail.HasValue ? Round(memUsed + memAvail) : null,
                load = Round(Find(all, mem, SensorType.Load, "Memory"), 0),
            },
            storage,
            board = new { temps = boardTemps, fans },
            coolers,
            fanProfile = _profile,
        };
    }

    private static bool IsPump(string name) =>
        name.Contains("Pump", StringComparison.OrdinalIgnoreCase) || name.Contains("AIO", StringComparison.OrdinalIgnoreCase);

    private static float Interpolate((float T, float P)[] curve, float t)
    {
        if (t <= curve[0].T) return curve[0].P;
        for (int i = 1; i < curve.Length; i++)
        {
            if (t <= curve[i].T)
            {
                var (t0, p0) = curve[i - 1];
                var (t1, p1) = curve[i];
                return p0 + (p1 - p0) * (t - t0) / (t1 - t0);
            }
        }
        return curve[^1].P;
    }

    private void ApplyFanCurve(List<(IHardware Hw, ISensor S)> all)
    {
        if (_profile == "auto") return;
        var temp = CpuTemp(all);
        var controls = all.Where(x => x.Hw.HardwareType == HardwareType.SuperIO && x.S.SensorType == SensorType.Control && x.S.Control != null).ToList();
        if (temp == null)
        {
            Log.Warn("Température CPU indisponible : retour au contrôle du BIOS");
            _profile = "auto";
            RestoreDefaultFans();
            return;
        }
        var target = temp >= PanicTemp ? 100f : Math.Max(MinDuty, Interpolate(Profiles[_profile].Curve, temp.Value));
        foreach (var (hw, s) in controls)
        {
            var fan = all.FirstOrDefault(x => x.Hw == hw && x.S.SensorType == SensorType.Fan && x.S.Index == s.Index).S;
            if (fan == null || fan.Value is not > 0 || IsPump(fan.Name)) continue; // ventilateur absent ou pompe
            var key = $"{hw.Identifier}/{s.Index}";
            var last = _lastDuty.TryGetValue(key, out var v) ? v : target;
            // monte tout de suite, redescend doucement (5 % par cycle)
            var duty = target >= last ? target : Math.Max(target, last - 5f);
            var min = s.Control!.MinSoftwareValue;
            var max = s.Control.MaxSoftwareValue;
            duty = Math.Clamp(duty, Math.Max(min, MinDuty), max);
            s.Control.SetSoftware(duty);
            _lastDuty[key] = duty;
        }
    }

    private void RestoreDefaultFans()
    {
        _lastDuty.Clear();
        try
        {
            foreach (var (_, s) in Flatten().Where(x => x.S.SensorType == SensorType.Control && x.S.Control != null && x.Hw.HardwareType == HardwareType.SuperIO))
                s.Control!.SetDefault();
        }
        catch (Exception ex) { Log.Error("Retour ventilateurs au BIOS", ex); }
    }

    public void Dispose()
    {
        lock (_gate)
        {
            RestoreDefaultFans(); // toujours rendre la main au BIOS en quittant
            try { _computer.Close(); } catch { }
        }
    }
}
