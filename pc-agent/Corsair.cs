using System.Runtime.InteropServices;
using System.Text;

namespace HomeDashboardAgent;

// Pilotage des LED Corsair via le SDK officiel iCUE v4 (iCUE doit tourner,
// avec l'option « contrôle par des logiciels tiers / SDK » activée).
public sealed class Corsair : IDisposable
{
    private const string Dll = "iCUESDK.x64_2019.dll";
    private const int CE_Success = 0;
    private const int CSS_Connected = 6;
    private const int CDT_All = unchecked((int)0xFFFFFFFF);
    private const int CAL_Shared = 0;
    private const int CAL_ExclusiveLightingControl = 1;
    private const int CDPI_BatteryLevel = 9;
    private const int CDPI_ChannelDeviceTypeArray = 13;
    private const int CT_Int32 = 1;
    private const int CT_Int32_Array = 17;

    [StructLayout(LayoutKind.Sequential)]
    private struct DeviceFilter { public int deviceTypeMask; }

    [StructLayout(LayoutKind.Sequential)]
    private struct DeviceInfo
    {
        public int type;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 128)] public byte[] id;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 128)] public byte[] serial;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 128)] public byte[] model;
        public int ledCount;
        public int channelCount;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct LedPosition { public uint id; public double cx; public double cy; }

    [StructLayout(LayoutKind.Sequential)]
    private struct LedColor { public uint id; public byte r, g, b, a; }

    [StructLayout(LayoutKind.Explicit, Size = 24)]
    private struct Property
    {
        [FieldOffset(0)] public int type;
        [FieldOffset(8)] public int int32;
        [FieldOffset(8)] public IntPtr items;
        [FieldOffset(16)] public uint count;
    }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    private delegate void StateHandler(IntPtr context, IntPtr eventData);

    [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)] private static extern int CorsairConnect(StateHandler onStateChanged, IntPtr context);
    [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)] private static extern int CorsairDisconnect();
    [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)] private static extern int CorsairGetDevices(ref DeviceFilter filter, int sizeMax, [Out] DeviceInfo[] devices, out int size);
    [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)] private static extern int CorsairGetLedPositions(byte[] deviceId, int sizeMax, [Out] LedPosition[] positions, out int size);
    [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)] private static extern int CorsairSetLedColors(byte[] deviceId, int size, LedColor[] colors);
    [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)] private static extern int CorsairRequestControl(byte[] deviceId, int accessLevel);
    [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)] private static extern int CorsairReleaseControl(byte[] deviceId);
    [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)] private static extern int CorsairReadDeviceProperty(byte[] deviceId, int propertyId, uint index, out Property property);
    [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)] private static extern int CorsairFreeProperty(ref Property property);
    [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)] private static extern int CorsairSetLayerPriority(uint priority);

    private static readonly string[] TypeNames =
    {
        "Clavier", "Souris", "Tapis", "Casque", "Support casque", "Contrôleur ventilateurs", "Contrôleur LED",
        "Mémoire", "Refroidissement", "Carte mère", "Carte graphique", "Touchbar", "Manette",
    };
    private static readonly string[] ChannelTypes =
    {
        "?", "Ventilateur HD", "Ventilateur SP", "Ventilateur LL", "Ventilateur ML", "Ventilateur QL", "Ventilateur 8 LED",
        "Bande LED", "DAP", "Pompe", "RAM", "Waterblock", "Ventilateur QX",
    };

    private readonly object _gate = new();
    private readonly StateHandler _handler; // gardé en vie pour le code natif
    private volatile int _state;
    private bool _available = true;
    public bool Connected => _state == CSS_Connected;
    public string StateText => !_available ? "SDK iCUE introuvable" : _state switch
    {
        6 => "connecté",
        2 => "connexion…",
        3 or 5 => "iCUE ne répond pas",
        4 => "refusé par iCUE (active le SDK dans les réglages d'iCUE)",
        _ => "déconnecté",
    };
    public event Action? OnConnected;

    public Corsair() { _handler = OnState; }

    public void Start()
    {
        try
        {
            var err = CorsairConnect(_handler, IntPtr.Zero);
            Log.Info($"Corsair : connexion demandée ({err})");
        }
        catch (DllNotFoundException ex) { _available = false; Log.Error("Corsair : DLL du SDK absente", ex); }
        catch (Exception ex) { _available = false; Log.Error("Corsair : démarrage", ex); }
    }

    private void OnState(IntPtr context, IntPtr data)
    {
        var state = Marshal.ReadInt32(data);
        var was = _state;
        _state = state;
        Log.Info($"Corsair : état {state}");
        if (state == CSS_Connected && was != CSS_Connected)
            Task.Run(() => { Thread.Sleep(1500); OnConnected?.Invoke(); }); // laisse iCUE finir l'énumération
    }

    private static byte[] Id(string id)
    {
        var b = new byte[128];
        var src = Encoding.UTF8.GetBytes(id);
        Array.Copy(src, b, Math.Min(src.Length, 127));
        return b;
    }

    private static string Str(byte[] b)
    {
        var n = Array.IndexOf(b, (byte)0);
        return Encoding.UTF8.GetString(b, 0, n < 0 ? b.Length : n);
    }

    private List<(string Id, int Type, string Model, int Leds, int Channels)> Devices()
    {
        var filter = new DeviceFilter { deviceTypeMask = CDT_All };
        var arr = new DeviceInfo[64];
        for (int i = 0; i < arr.Length; i++)
            arr[i] = new DeviceInfo { id = new byte[128], serial = new byte[128], model = new byte[128] };
        var err = CorsairGetDevices(ref filter, arr.Length, arr, out var size);
        if (err != CE_Success) throw new InvalidOperationException($"CorsairGetDevices : erreur {err}");
        return arr.Take(size).Select(d => (Str(d.id), d.type, Str(d.model), d.ledCount, d.channelCount)).ToList();
    }

    private static string TypeName(int mask)
    {
        for (int i = 0; i < TypeNames.Length; i++) if ((mask & (1 << i)) != 0) return TypeNames[i];
        return "Autre";
    }

    public object Describe()
    {
        lock (_gate)
        {
            if (!Connected) return new { connected = false, state = StateText, devices = Array.Empty<object>() };
            try
            {
                var list = Devices().Select(d =>
                {
                    int? battery = null;
                    if (CorsairReadDeviceProperty(Id(d.Id), CDPI_BatteryLevel, 0, out var p) == CE_Success && p.type == CT_Int32)
                        battery = p.int32;
                    var channels = new List<object>();
                    for (uint c = 0; c < d.Channels; c++)
                    {
                        if (CorsairReadDeviceProperty(Id(d.Id), CDPI_ChannelDeviceTypeArray, c, out var cp) == CE_Success && cp.type == CT_Int32_Array)
                        {
                            var types = new int[cp.count];
                            if (cp.count > 0) Marshal.Copy(cp.items, types, 0, (int)cp.count);
                            CorsairFreeProperty(ref cp);
                            channels.Add(new { channel = c, devices = types.Select(t => t >= 0 && t < ChannelTypes.Length ? ChannelTypes[t] : "?").ToArray() });
                        }
                    }
                    return (object)new { id = d.Id, model = d.Model, type = TypeName(d.Type), leds = d.Leds, battery, channels };
                }).ToList();
                return new { connected = true, state = StateText, devices = list };
            }
            catch (Exception ex)
            {
                Log.Error("Corsair : liste des appareils", ex);
                return new { connected = true, state = "erreur de lecture", devices = Array.Empty<object>() };
            }
        }
    }

    // Couleur unie sur toutes les LED de tous les appareils Corsair
    public void SetColor(byte r, byte g, byte b)
    {
        lock (_gate)
        {
            if (!Connected) throw new InvalidOperationException($"iCUE : {StateText}");
            CorsairSetLayerPriority(200);
            foreach (var d in Devices())
            {
                var id = Id(d.Id);
                CorsairRequestControl(id, CAL_ExclusiveLightingControl);
                var pos = new LedPosition[Math.Max(d.Leds, 1)];
                if (CorsairGetLedPositions(id, pos.Length, pos, out var n) != CE_Success || n == 0) continue;
                var colors = pos.Take(n).Select(p => new LedColor { id = p.id, r = r, g = g, b = b, a = 255 }).ToArray();
                var err = CorsairSetLedColors(id, colors.Length, colors);
                if (err != CE_Success) Log.Warn($"Corsair : {d.Model} a refusé les couleurs ({err})");
            }
        }
    }

    // Rend la main aux profils d'iCUE
    public void Release()
    {
        lock (_gate)
        {
            if (!Connected) return;
            try
            {
                foreach (var d in Devices()) CorsairReleaseControl(Id(d.Id));
            }
            catch (Exception ex) { Log.Error("Corsair : retour à iCUE", ex); }
        }
    }

    public void Dispose()
    {
        try { Release(); CorsairDisconnect(); } catch { }
    }
}
