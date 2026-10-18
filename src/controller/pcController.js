// Relais vers l'agent du PC Windows (HomeDashboard Agent) + historique des capteurs.
// L'agent n'accepte que ce serveur (IP + jeton) ; l'app ne lui parle jamais directement.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AGENT_URL = (process.env.PC_AGENT_URL || "").replace(/\/$/, "");
const AGENT_TOKEN = process.env.PC_AGENT_TOKEN || "";
const DATA_DIR = fileURLToPath(new URL("../../data", import.meta.url));
const HISTORY_FILE = path.join(DATA_DIR, "pc-history.json");
const HISTORY_MAX = 24 * 60; // 24 h à une mesure par minute

let latest = null;        // dernier relevé complet
let lastSeen = null;      // date du dernier relevé réussi
let online = false;
let history = [];         // { t, cpuTemp, gpuTemp, cpuLoad, gpuLoad, cpuPower, gpuPower }
let minuteBucket = null;  // agrégation des relevés de la minute en cours

try { history = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8")); } catch { history = []; }

const agent = async (p, { method = "GET", body, timeout = 4000 } = {}) => {
  if (!AGENT_URL || !AGENT_TOKEN) throw Object.assign(new Error("Agent PC non configuré"), { status: 503 });
  const r = await fetch(AGENT_URL + p, {
    method,
    headers: { "X-Agent-Token": AGENT_TOKEN, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeout),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw Object.assign(new Error(data?.message || `Agent : erreur ${r.status}`), { status: r.status });
  return data;
};

const avg = (arr) => {
  const v = arr.filter((x) => typeof x === "number");
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
};

const record = (s) => {
  const minute = Math.floor(Date.now() / 60000) * 60000;
  const point = {
    cpuTemp: s.cpu?.temp, gpuTemp: s.gpu?.temp,
    cpuLoad: s.cpu?.load, gpuLoad: s.gpu?.load,
    cpuPower: s.cpu?.power, gpuPower: s.gpu?.power,
  };
  if (!minuteBucket || minuteBucket.t !== minute) {
    if (minuteBucket) {
      const keys = Object.keys(point);
      history.push({ t: minuteBucket.t, ...Object.fromEntries(keys.map((k) => [k, avg(minuteBucket.samples.map((x) => x[k]))])) });
      if (history.length > HISTORY_MAX) history = history.slice(-HISTORY_MAX);
    }
    minuteBucket = { t: minute, samples: [] };
  }
  minuteBucket.samples.push(point);
};

let saveTimer = 0;
const saveHistory = () => {
  if (Date.now() - saveTimer < 5 * 60 * 1000) return;
  saveTimer = Date.now();
  fs.mkdir(DATA_DIR, { recursive: true }, () =>
    fs.writeFile(HISTORY_FILE, JSON.stringify(history), () => {}));
};

// Relevé toutes les 10 s quand le PC répond, toutes les 60 s quand il est éteint
const poll = async () => {
  let delay = 60000;
  if (AGENT_URL && AGENT_TOKEN) {
    try {
      latest = await agent("/status", { timeout: 3000 });
      lastSeen = new Date().toISOString();
      if (!online) console.log("PC : en ligne");
      online = true;
      record(latest);
      saveHistory();
      delay = 10000;
    } catch {
      if (online) console.log("PC : hors ligne");
      online = false;
    }
  }
  setTimeout(poll, delay);
};
setTimeout(poll, 2000);

const fail = (res, e) => {
  if (e.status === 503 || e.name === "TimeoutError" || e.cause) {
    return res.status(503).json({ message: "PC éteint ou agent injoignable" });
  }
  res.status(e.status && e.status < 500 ? e.status : 502).json({ message: e.message });
};

export const getPcStatus = (req, res) => {
  res.json({
    configured: !!(AGENT_URL && AGENT_TOKEN),
    online,
    lastSeen,
    status: online ? latest : null,
  });
};

export const getPcHistory = (req, res) => {
  const hours = Math.min(24, Math.max(1, Number(req.query.hours) || 24));
  const since = Date.now() - hours * 3600 * 1000;
  res.json(history.filter((p) => p.t >= since));
};

export const getPcLighting = async (req, res) => {
  try { res.json(await agent("/lighting", { timeout: 6000 })); } catch (e) { fail(res, e); }
};

export const setPcLighting = async (req, res) => {
  const { mode, color, brightness } = req.body || {};
  if (mode !== "auto" && mode !== "color") return res.status(400).json({ message: "Mode invalide" });
  if (mode === "color" && !/^#[0-9a-f]{6}$/i.test(color || "")) return res.status(400).json({ message: "Couleur invalide" });
  const body = mode === "auto" ? { mode } : { mode, color, brightness: Math.max(0, Math.min(100, Number(brightness ?? 100))) };
  try { res.json(await agent("/lighting", { method: "POST", body, timeout: 10000 })); } catch (e) { fail(res, e); }
};

export const getPcFans = async (req, res) => {
  try { res.json(await agent("/fans")); } catch (e) { fail(res, e); }
};

export const setPcFans = async (req, res) => {
  const { profile } = req.body || {};
  if (!["auto", "silencieux", "normal", "performance"].includes(profile)) {
    return res.status(400).json({ message: "Profil invalide" });
  }
  try { res.json(await agent("/fans", { method: "POST", body: { profile } })); } catch (e) { fail(res, e); }
};
