// Pilotage des lumières par le serveur (même réseau que les lampes).
// Utilisé par la web app : un navigateur en HTTPS ne peut pas parler
// directement au pont Hue ou au Nanoleaf (http sur le réseau local).
import net from "node:net";
import db from "../../db.js";

const TIMEOUT_MS = 4000;

// Uniquement des adresses du réseau local (évite que le serveur serve de relais vers Internet)
const isPrivateIp = (ip) =>
  typeof ip === "string" &&
  /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/.test(ip);

const http = async (url, options = {}) => {
  const r = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await r.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: r.status, ok: r.ok, body };
};

// Couleur hexadécimale -> teinte (0-360), saturation (0-1), valeur (0-1)
const hexToHsv = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? d / max : 0, v: max };
};

const hsvToHex = (h, s, v) => {
  const f = (n) => {
    const k = (n + h / 60) % 6;
    return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255);
  };
  return "#" + [f(5), f(3), f(1)].map((x) => x.toString(16).padStart(2, "0")).join("");
};

const clampPct = (x) => Math.max(0, Math.min(100, Math.round(Number(x))));

// ---------- Stockage des appairages (tables existantes) ----------
const getHueUser = async (userId) => {
  const rows = await db.query("SELECT username FROM huebridgetokens WHERE user_id = ? ORDER BY id DESC LIMIT 1", [userId]);
  return rows[0]?.username || null;
};
const setHueUser = async (userId, username) => {
  await db.query("DELETE FROM huebridgetokens WHERE user_id = ?", [userId]);
  if (username) await db.query("INSERT INTO huebridgetokens (username, user_id) VALUES (?, ?)", [username, userId]);
};
// nanoleaftoken.token contient {"ip","token"} en JSON
const getNanoleaf = async (userId) => {
  const rows = await db.query("SELECT token FROM nanoleaftoken WHERE user_id = ? ORDER BY id DESC LIMIT 1", [userId]);
  if (!rows[0]) return null;
  try {
    const v = JSON.parse(rows[0].token);
    return isPrivateIp(v.ip) && v.token ? v : null;
  } catch {
    return process.env.NANOLEAF_IP ? { ip: process.env.NANOLEAF_IP, token: rows[0].token } : null;
  }
};
const setNanoleaf = async (userId, value) => {
  await db.query("DELETE FROM nanoleaftoken WHERE user_id = ?", [userId]);
  if (value) await db.query("INSERT INTO nanoleaftoken (token, user_id) VALUES (?, ?)", [JSON.stringify(value), userId]);
};

// ---------- Pont Hue ----------
let bridgeCache = { ip: null, at: 0 };
const findBridgeIp = async () => {
  if (isPrivateIp(process.env.HUE_BRIDGE_IP)) return process.env.HUE_BRIDGE_IP;
  if (bridgeCache.ip && Date.now() - bridgeCache.at < 10 * 60 * 1000) return bridgeCache.ip;
  try {
    const r = await http("https://discovery.meethue.com/");
    const ip = Array.isArray(r.body) ? r.body.map((b) => b.internalipaddress).find(isPrivateIp) : null;
    if (ip) bridgeCache = { ip, at: Date.now() };
    return ip || null;
  } catch {
    return bridgeCache.ip;
  }
};

const hueStatus = async (userId) => {
  const username = await getHueUser(userId);
  const ip = await findBridgeIp();
  if (!ip) return { paired: !!username, reachable: false, lights: [], message: "Pont Hue introuvable sur le réseau" };
  if (!username) return { paired: false, reachable: true, lights: [] };
  try {
    const r = await http(`http://${ip}/api/${encodeURIComponent(username)}/lights`);
    if (Array.isArray(r.body) && r.body[0]?.error) {
      return { paired: false, reachable: true, lights: [], message: "Appairage expiré, recommence" };
    }
    const lights = Object.entries(r.body || {}).map(([id, l]) => ({
      id,
      name: l.name,
      on: !!l.state?.on,
      reachable: l.state?.reachable !== false,
      brightness: l.state?.bri != null ? clampPct((l.state.bri / 254) * 100) : null,
      color:
        l.state?.hue != null && l.state?.sat != null
          ? hsvToHex((l.state.hue / 65535) * 360, l.state.sat / 254, 1)
          : null,
      type: l.type,
    }));
    return { paired: true, reachable: true, lights };
  } catch {
    return { paired: true, reachable: false, lights: [], message: "Le pont Hue ne répond pas" };
  }
};

// ---------- Nanoleaf ----------
// Cherche un Nanoleaf (port 16021) sur le /24 du serveur
const scanNanoleaf = async () => {
  const prefix = (process.env.LAN_PREFIX || "192.168.1").replace(/\.$/, "");
  const probe = (ip) =>
    new Promise((resolve) => {
      const s = net.createConnection({ host: ip, port: 16021, timeout: 700 });
      s.once("connect", () => { s.destroy(); resolve(ip); });
      s.once("timeout", () => { s.destroy(); resolve(null); });
      s.once("error", () => resolve(null));
    });
  const ips = Array.from({ length: 254 }, (_, i) => `${prefix}.${i + 1}`);
  const found = await Promise.all(ips.map(probe));
  return found.find(Boolean) || null;
};

const nanoleafStatus = async (userId) => {
  const cfg = await getNanoleaf(userId);
  if (!cfg) return { paired: false };
  try {
    const r = await http(`http://${cfg.ip}:16021/api/v1/${encodeURIComponent(cfg.token)}`);
    if (r.status === 401 || r.status === 403) return { paired: false, message: "Appairage expiré, recommence" };
    const s = r.body?.state || {};
    return {
      paired: true,
      reachable: true,
      name: r.body?.name || "Nanoleaf",
      on: !!s.on?.value,
      brightness: s.brightness?.value ?? null,
      color: s.hue?.value != null && s.sat?.value != null ? hsvToHex(s.hue.value, s.sat.value / 100, 1) : null,
    };
  } catch {
    return { paired: true, reachable: false, message: "Le Nanoleaf ne répond pas" };
  }
};

// ---------- Routes ----------
export const getLightsStatus = async (req, res) => {
  try {
    const [hue, nanoleaf] = await Promise.all([hueStatus(req.userId), nanoleafStatus(req.userId)]);
    res.json({ hue, nanoleaf });
  } catch (e) {
    console.error("Erreur état lumières :", e.code || e.message);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

export const pairHue = async (req, res) => {
  try {
    const ip = await findBridgeIp();
    if (!ip) return res.status(404).json({ message: "Pont Hue introuvable sur le réseau" });
    const r = await http(`http://${ip}/api`, {
      method: "POST",
      body: JSON.stringify({ devicetype: "homedashboard#serveur" }),
    });
    const ok = Array.isArray(r.body) && r.body[0]?.success?.username;
    if (!ok) {
      return res.status(409).json({ message: "Appuie sur le bouton rond du pont Hue, puis réessaie dans les 30 secondes" });
    }
    await setHueUser(req.userId, r.body[0].success.username);
    res.json({ message: "Pont Hue appairé" });
  } catch (e) {
    console.error("Erreur appairage Hue :", e.code || e.message);
    res.status(502).json({ message: "Le pont Hue ne répond pas" });
  }
};

export const unpairHue = async (req, res) => {
  await setHueUser(req.userId, null);
  res.json({ message: "Pont Hue oublié" });
};

// body : { on?, brightness? (0-100), color? "#rrggbb" } ; :id = numéro de lampe ou "all"
export const setHueLight = async (req, res) => {
  const { id } = req.params;
  if (id !== "all" && !/^\d{1,3}$/.test(id)) return res.status(400).json({ message: "Lampe invalide" });
  const { on, brightness, color } = req.body || {};
  const state = {};
  if (typeof on === "boolean") state.on = on;
  if (brightness != null) state.bri = Math.max(1, Math.round((clampPct(brightness) / 100) * 254));
  if (color != null) {
    const hsv = hexToHsv(color);
    if (!hsv) return res.status(400).json({ message: "Couleur invalide" });
    state.hue = Math.round((hsv.h / 360) * 65535);
    state.sat = Math.round(hsv.s * 254);
  }
  if (!Object.keys(state).length) return res.status(400).json({ message: "Rien à changer" });

  try {
    const username = await getHueUser(req.userId);
    const ip = await findBridgeIp();
    if (!username || !ip) return res.status(409).json({ message: "Pont Hue non appairé" });
    const path = id === "all" ? "groups/0/action" : `lights/${id}/state`;
    const r = await http(`http://${ip}/api/${encodeURIComponent(username)}/${path}`, {
      method: "PUT",
      body: JSON.stringify(state),
    });
    const err = Array.isArray(r.body) && r.body.find((x) => x.error);
    if (err) return res.status(400).json({ message: err.error.description || "Refusé par le pont" });
    res.json({ message: "OK" });
  } catch (e) {
    console.error("Erreur commande Hue :", e.code || e.message);
    res.status(502).json({ message: "Le pont Hue ne répond pas" });
  }
};

// body : { ip? } ; sans ip, le serveur cherche le Nanoleaf sur le réseau
export const pairNanoleaf = async (req, res) => {
  try {
    let ip = req.body?.ip || process.env.NANOLEAF_IP || null;
    if (ip && !isPrivateIp(ip)) return res.status(400).json({ message: "Adresse IP locale invalide" });
    if (!ip) ip = await scanNanoleaf();
    if (!ip) return res.status(404).json({ message: "Aucun Nanoleaf trouvé sur le réseau (allumé ?)" });
    const r = await http(`http://${ip}:16021/api/v1/new`, { method: "POST" });
    if (!r.ok || !r.body?.auth_token) {
      return res.status(409).json({
        message: "Maintiens le bouton marche du Nanoleaf 5 à 7 secondes (la LED clignote), puis réessaie dans les 30 secondes",
        ip,
      });
    }
    await setNanoleaf(req.userId, { ip, token: r.body.auth_token });
    res.json({ message: "Nanoleaf appairé", ip });
  } catch (e) {
    console.error("Erreur appairage Nanoleaf :", e.code || e.message);
    res.status(502).json({ message: "Le Nanoleaf ne répond pas" });
  }
};

export const unpairNanoleaf = async (req, res) => {
  await setNanoleaf(req.userId, null);
  res.json({ message: "Nanoleaf oublié" });
};

// body : { on?, brightness? (0-100), color? "#rrggbb" }
export const setNanoleafState = async (req, res) => {
  const { on, brightness, color } = req.body || {};
  const state = {};
  if (typeof on === "boolean") state.on = { value: on };
  if (brightness != null) state.brightness = { value: clampPct(brightness) };
  if (color != null) {
    const hsv = hexToHsv(color);
    if (!hsv) return res.status(400).json({ message: "Couleur invalide" });
    state.hue = { value: Math.round(hsv.h) };
    state.sat = { value: Math.round(hsv.s * 100) };
  }
  if (!Object.keys(state).length) return res.status(400).json({ message: "Rien à changer" });
  try {
    const cfg = await getNanoleaf(req.userId);
    if (!cfg) return res.status(409).json({ message: "Nanoleaf non appairé" });
    const r = await http(`http://${cfg.ip}:16021/api/v1/${encodeURIComponent(cfg.token)}/state`, {
      method: "PUT",
      body: JSON.stringify(state),
    });
    if (!r.ok) return res.status(502).json({ message: `Refusé par le Nanoleaf (${r.status})` });
    res.json({ message: "OK" });
  } catch (e) {
    console.error("Erreur commande Nanoleaf :", e.code || e.message);
    res.status(502).json({ message: "Le Nanoleaf ne répond pas" });
  }
};
