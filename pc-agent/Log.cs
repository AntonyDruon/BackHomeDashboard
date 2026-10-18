namespace HomeDashboardAgent;

// Journal simple dans %ProgramData%\HomeDashboardAgent\agent.log (taille limitée)
public static class Log
{
    private static readonly object Gate = new();
    public static string Dir { get; } = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "HomeDashboardAgent");
    private static string FilePath => Path.Combine(Dir, "agent.log");

    public static void Info(string msg) => Write("INFO", msg);
    public static void Warn(string msg) => Write("WARN", msg);
    public static void Error(string msg, Exception? ex = null) =>
        Write("ERROR", ex == null ? msg : $"{msg} : {ex.GetType().Name} {ex.Message}");

    private static void Write(string level, string msg)
    {
        try
        {
            lock (Gate)
            {
                Directory.CreateDirectory(Dir);
                var fi = new FileInfo(FilePath);
                if (fi.Exists && fi.Length > 2_000_000)
                {
                    File.Copy(FilePath, FilePath + ".1", true);
                    File.WriteAllText(FilePath, "");
                }
                File.AppendAllText(FilePath, $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} {level} {msg}{Environment.NewLine}");
            }
        }
        catch { /* le journal ne doit jamais faire tomber l'agent */ }
    }
}
