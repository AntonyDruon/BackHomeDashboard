// Prochains passages du bus 118 en temps réel (API PRIM d'Île-de-France Mobilités).
// La clé PRIM reste sur le serveur (.env : PRIM_API_KEY) ; l'app n'appelle que cette route.

const PRIM_URL = "https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring";
const LINE_REF = "STIF:Line::C01147:"; // ligne 118
const TO_CHATEAU = "Château de Vincennes";
const TO_FONTENAY = "Gare de Val de Fontenay";

// Zones d'arrêt (StopArea IDFM), dans l'ordre de la ligne vers Val de Fontenay.
// directions : sens affichés pour cet arrêt (terminus = un seul sens).
const STOPS = [
  { id: "vincennes-rer", name: "Vincennes RER", area: "71651", directions: [TO_CHATEAU, TO_FONTENAY] },
  { id: "liberation", name: "Libération", area: "71657", directions: [TO_CHATEAU, TO_FONTENAY] },
  { id: "clement-vienot", name: "Clément Vienot", area: "71660", directions: [TO_CHATEAU, TO_FONTENAY] },
  { id: "val-de-fontenay", name: "Gare de Val de Fontenay", area: "71718", directions: [TO_CHATEAU] },
];

const CACHE_MS = 30 * 1000;
let cache = { at: 0, data: null, pending: null };

const firstValue = (arr) => (Array.isArray(arr) && arr[0]?.value) || null;

// Transforme une réponse SIRI en passages { destination, time, minutes, status, atStop }
export const parseVisits = (siri, now = Date.now()) => {
  const delivery = siri?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0];
  const visits = delivery?.MonitoredStopVisit || [];
  return visits
    .map((v) => {
      const j = v.MonitoredVehicleJourney || {};
      const c = j.MonitoredCall || {};
      const iso =
        c.ExpectedDepartureTime || c.ExpectedArrivalTime ||
        c.AimedDepartureTime || c.AimedArrivalTime;
      if (!iso) return null;
      const t = Date.parse(iso);
      return {
        destination: firstValue(j.DestinationName) || firstValue(j.DirectionName) || "?",
        time: new Date(t).toISOString(),
        minutes: Math.max(0, Math.round((t - now) / 60000)),
        status: c.DepartureStatus || c.ArrivalStatus || null, // onTime, delayed, cancelled…
        atStop: c.VehicleAtStop === true,
        _t: t,
      };
    })
    .filter((p) => p && p._t >= now - 60 * 1000) // ignore les passages déjà partis
    .sort((a, b) => a._t - b._t)
    .map(({ _t, ...p }) => p);
};

const fetchStop = async (stop, apiKey) => {
  const url = `${PRIM_URL}?MonitoringRef=${encodeURIComponent(`STIF:StopArea:SP:${stop.area}:`)}&LineRef=${encodeURIComponent(LINE_REF)}`;
  const base = { id: stop.id, name: stop.name };
  try {
    const r = await fetch(url, {
      headers: { apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const passages = parseVisits(await r.json());
    return {
      ...base,
      error: null,
      directions: stop.directions.map((destination) => ({
        destination,
        departures: passages.filter((p) => p.destination === destination).slice(0, 3),
      })),
    };
  } catch (e) {
    console.error(`PRIM ${stop.name} :`, e.name === "TimeoutError" ? "délai dépassé" : e.message);
    return {
      ...base,
      error: "Temps réel indisponible",
      directions: stop.directions.map((destination) => ({ destination, departures: [] })),
    };
  }
};

const load = async (apiKey) => {
  const stops = await Promise.all(STOPS.map((s) => fetchStop(s, apiKey)));
  return { line: "118", updatedAt: new Date().toISOString(), stops };
};

export const getBus118 = async (req, res) => {
  const apiKey = process.env.PRIM_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ message: "Clé PRIM non configurée" });
  }
  try {
    if (!cache.data || Date.now() - cache.at > CACHE_MS) {
      // une seule requête PRIM à la fois, partagée entre les appels simultanés
      cache.pending = cache.pending || load(apiKey).finally(() => { cache.pending = null; });
      const data = await cache.pending;
      cache = { at: Date.now(), data, pending: null };
    }
    // minutes recalculées à chaque appel (le cache peut avoir jusqu'à 30 s)
    const now = Date.now();
    const stops = cache.data.stops.map((s) => ({
      ...s,
      directions: s.directions.map((d) => ({
        ...d,
        departures: d.departures
          .filter((p) => Date.parse(p.time) >= now - 60 * 1000)
          .map((p) => ({ ...p, minutes: Math.max(0, Math.round((Date.parse(p.time) - now) / 60000)) })),
      })),
    }));
    res.json({ ...cache.data, stops });
  } catch (e) {
    console.error("Erreur transport 118 :", e.message);
    res.status(502).json({ message: "Temps réel indisponible" });
  }
};
