// HomeDashboard — web app (PWA), sans dépendance ni étape de build.
// Tout le contenu venant de l'API est inséré en texte (jamais en HTML).

/* ================= Outils DOM ================= */
const el = (tag, props = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (k === "style" && typeof v === "object") Object.assign(node.style, v);
    else if (k in node && typeof v !== "string") node[k] = v;
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
};

// Icônes (tracés constants, aucune donnée externe)
const ICONS = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5v-5h4v5"/>',
  bus: '<rect x="4.5" y="3.5" width="15" height="14" rx="3"/><path d="M4.5 11h15M8 20.5v-3M16 20.5v-3"/><circle cx="8.5" cy="14.3" r=".9" fill="currentColor"/><circle cx="15.5" cy="14.3" r=".9" fill="currentColor"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  tasks: '<path d="m4 6.5 1.8 1.8L9 5M4 12.5l1.8 1.8L9 11M4 18.5l1.8 1.8L9 17M12 7h8M12 13h8M12 19h8"/>',
  note: '<path d="M6 3.5h9l3.5 3.5v13.5H6z"/><path d="M14.5 3.5V7.5h4M9 12h6M9 16h6"/>',
  bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2V16h5v-.1c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  room: '<path d="M4 20.5V8l8-4.5L20 8v12.5"/><path d="M9.5 20.5V14h5v6.5"/>',
  admin: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/>',
  logout: '<path d="M14 4.5h4.5v15H14M10 8l-4 4 4 4M6 12h10"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4.5H15"/>',
  chevL: '<path d="m14.5 5-7 7 7 7"/>',
  chevR: '<path d="m9.5 5 7 7-7 7"/>',
  pc: '<rect x="6" y="2.5" width="12" height="19" rx="2"/><circle cx="12" cy="15" r="2.6"/><path d="M9 6.5h6M9 9h6"/>',
  fan: '<circle cx="12" cy="12" r="1.6"/><path d="M12 10.4c0-3 .8-6.4 3.6-6.4 2.4 0 2.6 3.4.3 4.8L13.4 10M13.6 12c3 0 6.4.8 6.4 3.6 0 2.4-3.4 2.6-4.8.3L14 13.4M12 13.6c0 3-.8 6.4-3.6 6.4-2.4 0-2.6-3.4-.3-4.8l2.5-1.6M10.4 12c-3 0-6.4-.8-6.4-3.6 0-2.4 3.4-2.6 4.8-.3L10 10.6"/>',
  power: '<path d="M12 3v8M7.5 6.3a7 7 0 1 0 9 0"/>',
};
const icon = (name) => {
  const t = document.createElement("template");
  t.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
  return t.content.firstChild;
};

const $app = () => document.getElementById("app");

// Remplace le contenu d'un nœud (accepte des tableaux imbriqués)
const setKids = (node, ...children) =>
  node.replaceChildren(...children.flat(Infinity).filter((c) => c != null && c !== false)
    .map((c) => (c instanceof Node ? c : document.createTextNode(String(c)))));

let toastTimer;
const toast = (msg, bad = false) => {
  document.querySelector(".toast")?.remove();
  const t = el("div", { class: `toast${bad ? " bad" : ""}`, role: "status" }, msg);
  document.body.append(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 3200);
};

// Feuille modale en bas d'écran ; build(close) renvoie le contenu
const openSheet = (build, onClose) => {
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    backdrop.remove();
    document.removeEventListener("keydown", onKey);
    onClose?.();
  };
  const onKey = (e) => e.key === "Escape" && close();
  const sheet = el("div", { class: "sheet", role: "dialog", "aria-modal": "true" });
  const backdrop = el("div", { class: "sheet-backdrop", onclick: (e) => e.target === backdrop && close() }, sheet);
  sheet.append(...[build(close)].flat());
  document.body.append(backdrop);
  document.addEventListener("keydown", onKey);
  sheet.querySelector("input:not([type=hidden]), select, textarea, button")?.focus();
  return close;
};

// Confirmation : résout true seulement si l'action est choisie
const confirmSheet = (question, actionLabel) =>
  new Promise((resolve) => {
    let ok = false;
    openSheet((close) => [
      el("h2", {}, question),
      el("div", { class: "actions" },
        el("button", { class: "btn", onclick: close }, "Annuler"),
        el("button", { class: "btn danger", onclick: () => { ok = true; close(); } }, actionLabel)
      ),
    ], () => resolve(ok));
  });

/* ================= Dates ================= */
const pad = (n) => String(n).padStart(2, "0");
const isoDay = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hhmm = (iso) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const fromIso = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const prettyDay = (s) => {
  const today = isoDay();
  const tomorrow = isoDay(new Date(Date.now() + 864e5));
  const yesterday = isoDay(new Date(Date.now() - 864e5));
  if (s === today) return "Aujourd'hui";
  if (s === tomorrow) return "Demain";
  if (s === yesterday) return "Hier";
  const d = fromIso(s);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

/* ================= API ================= */
const TOKEN_KEY = "hd_token";
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} },
};
let me = null;

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const api = async (path, { method = "GET", body } = {}) => {
  const headers = {};
  const token = store.get(TOKEN_KEY);
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let r;
  try {
    r = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, "Pas de connexion au serveur. Vérifie ton réseau.");
  }
  const data = await r.json().catch(() => null);
  if (r.status === 401 && path !== "/users/login") {
    logout(true);
    throw new ApiError(401, "Session expirée, reconnecte-toi.");
  }
  if (!r.ok) throw new ApiError(r.status, data?.message || data?.error || `Erreur ${r.status}`);
  return data;
};

const logout = (expired = false) => {
  store.set(TOKEN_KEY, null);
  me = null;
  if (expired) toast("Session expirée, reconnecte-toi.", true);
  location.hash = "#/connexion";
};

/* ================= Routeur ================= */
const TABS = [
  ["#/", "Accueil", "home"],
  ["#/bus", "Bus", "bus"],
  ["#/taches", "Tâches", "tasks"],
  ["#/notes", "Notes", "note"],
  ["#/lumieres", "Lumières", "bulb"],
  ["#/pc", "PC", "pc", true], // administrateurs uniquement
];

const renderTabbar = (active) => {
  document.querySelector(".tabbar")?.remove();
  if (!active) return;
  const nav = el("nav", { "aria-label": "Navigation principale" },
    TABS.filter(([, , , adminOnly]) => !adminOnly || me?.role === "admin").map(([href, label, ic]) =>
      el("a", { href, "aria-current": href === active ? "page" : null }, icon(ic), label)
    )
  );
  document.body.append(el("div", { class: "tabbar" }, nav));
};

let cleanup = null;
const routes = [];
const route = (pattern, tab, view, { public: isPublic = false } = {}) => routes.push({ pattern, tab, view, isPublic });

const navigate = async () => {
  if (cleanup) { try { cleanup(); } catch {} cleanup = null; }
  document.querySelector(".sheet-backdrop")?.remove();
  const hash = location.hash || "#/";
  const r = routes.find((x) => x.pattern.test(hash));
  if (!r) { location.hash = "#/"; return; }
  if (!r.isPublic && !store.get(TOKEN_KEY)) { location.hash = "#/connexion"; return; }
  if (r.isPublic && store.get(TOKEN_KEY)) { location.hash = "#/"; return; }

  if (!r.isPublic && !me) {
    try { me = await api("/users/me"); } catch (e) { if (e.status === 401) return; }
  }
  const root = $app();
  setKids(root, );
  renderTabbar(r.isPublic ? null : r.tab);
  window.scrollTo(0, 0);
  const params = hash.match(r.pattern).slice(1);
  try {
    cleanup = (await r.view(root, ...params)) || null;
  } catch (e) {
    if (e.status !== 401) root.append(el("div", { class: "error-box" }, e.message));
  }
};

const head = (title, ...right) =>
  el("header", { class: "screen-head" }, el("h1", {}, title), ...right);

const loading = () => el("div", { class: "spinner", role: "status", "aria-label": "Chargement" });

// Rafraîchissement périodique, suspendu quand l'app est en arrière-plan
const every = (ms, fn) => {
  const id = setInterval(() => document.visibilityState === "visible" && fn(), ms);
  const onVis = () => document.visibilityState === "visible" && fn();
  document.addEventListener("visibilitychange", onVis);
  return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
};

/* ================= Connexion / inscription ================= */
const authScreen = (root, mode) => {
  const isLogin = mode === "login";
  const err = el("div", { class: "error-box", hidden: true });
  const submit = el("button", { class: "btn primary block", type: "submit" }, isLogin ? "Se connecter" : "Créer mon compte");

  const fields = isLogin
    ? []
    : [el("label", { class: "field" }, el("span", {}, "Prénom ou pseudo"),
        el("input", { class: "input", name: "username", required: true, autocomplete: "nickname", maxlength: 60 }))];

  const form = el("form", {
    onsubmit: async (e) => {
      e.preventDefault();
      err.hidden = true;
      submit.disabled = true;
      const f = Object.fromEntries(new FormData(form));
      try {
        if (!isLogin) await api("/users/new", { method: "POST", body: f });
        const { token } = await api("/users/login", { method: "POST", body: { email: f.email, password: f.password } });
        store.set(TOKEN_KEY, token);
        me = null;
        location.hash = "#/";
      } catch (ex) {
        err.textContent = ex.status === 401 ? "Email ou mot de passe incorrect." : ex.message;
        err.hidden = false;
      } finally {
        submit.disabled = false;
      }
    },
  },
    err,
    ...fields,
    el("label", { class: "field" }, el("span", {}, "Email"),
      el("input", { class: "input", name: "email", type: "email", required: true, autocomplete: "email", inputmode: "email" })),
    el("label", { class: "field" }, el("span", {}, "Mot de passe"),
      el("input", {
        class: "input", name: "password", type: "password", required: true,
        minlength: isLogin ? null : 8,
        autocomplete: isLogin ? "current-password" : "new-password",
      })),
    isLogin ? null : el("p", { class: "hint" }, "8 caractères minimum."),
    submit
  );

  root.append(el("section", { class: "auth" },
    el("img", { class: "brand-mark", src: "/icons/icon-192.png", alt: "" }),
    el("p", { class: "brand" }, "HomeDashboard"),
    el("p", { class: "hint" }, isLogin ? "Bus, tâches, notes et lumières de la maison." : "Crée ton compte pour la maison."),
    form,
    el("p", { class: "switch" },
      isLogin ? "Pas encore de compte ? " : "Déjà un compte ? ",
      el("a", { href: isLogin ? "#/inscription" : "#/connexion" }, isLogin ? "Créer un compte" : "Se connecter"))
  ));
};
route(/^#\/connexion$/, null, (root) => authScreen(root, "login"), { public: true });
route(/^#\/inscription$/, null, (root) => authScreen(root, "signup"), { public: true });

/* ================= Bus 118 ================= */
const FAV_KEY = "hd_fav_stop";
const favStop = () => store.get(FAV_KEY) || "liberation";

const departureCell = (p) => {
  const now = p.atStop || p.minutes <= 1;
  const cls = ["t", now && "now", p.status === "cancelled" && "cancelled", p.status === "delayed" && "late"].filter(Boolean).join(" ");
  const main = p.status === "cancelled"
    ? "suppr."
    : p.atStop ? "à quai" : now ? "proche" : [String(p.minutes), el("small", {}, "min")];
  return el("div", { class: cls, "aria-label": `${p.minutes} minutes, ${hhmm(p.time)}` },
    el("span", { class: "t-min" }, main),
    el("span", { class: "t-at" }, p.status === "delayed" ? `${hhmm(p.time)} retard` : hhmm(p.time))
  );
};

const busBoard = (stop, { onFav } = {}) =>
  el("article", { class: "board" },
    el("div", { class: "board-stop" },
      el("h3", {}, stop.name),
      onFav
        ? el("button", { class: "fav-btn", "aria-pressed": String(favStop() === stop.id), onclick: () => onFav(stop.id) },
            favStop() === stop.id ? "★ Sur l'accueil" : "☆ Mettre sur l'accueil")
        : el("span", { class: "line-badge" }, "118")
    ),
    stop.error
      ? el("p", { class: "board-none" }, stop.error)
      : stop.directions.map((d) =>
          el("div", { class: "board-row" },
            el("div", { class: "board-dest" }, "vers", el("strong", {}, d.destination)),
            d.departures.length
              ? el("div", { class: "board-times" }, d.departures.slice(0, 2).map((p) => departureCell(p)))
              : el("span", { class: "board-none" }, "aucun passage annoncé")
          )
        )
  );

route(/^#\/bus$/, "#/bus", async (root) => {
  const meta = el("div", { class: "board-meta" }, "Chargement…");
  const boards = el("div", {}, loading());
  const refreshBtn = el("button", { class: "icon-btn", "aria-label": "Actualiser", onclick: () => load() }, icon("refresh"));
  root.append(head("Bus 118", refreshBtn), meta, boards);

  let last = null;
  const draw = () => {
    if (!last) return;
    setKids(boards, ...last.stops.map((s) => busBoard(s, {
      onFav: (id) => { store.set(FAV_KEY, id); draw(); toast("Arrêt affiché sur l'accueil"); },
    })));
  };
  const load = async () => {
    refreshBtn.disabled = true;
    try {
      last = await api("/transport/118");
      setKids(meta, el("span", {}, `Temps réel IDFM, mis à jour à ${hhmm(last.updatedAt)}`), el("span", {}, "auto 30 s"));
      draw();
    } catch (e) {
      if (!last) setKids(boards, el("div", { class: "error-box" }, e.message));
      else toast(e.message, true);
    } finally {
      refreshBtn.disabled = false;
    }
  };
  await load();
  return every(30000, load);
});

/* ================= Tâches ================= */
const STATUSES = ["a faire", "en cours", "terminé"];
const STATUS_LABEL = { "a faire": "À faire", "en cours": "En cours", "terminé": "Terminé" };
const PRIOS = ["bas", "moyen", "haut"];
const PRIO_LABEL = { bas: "Basse", moyen: "Moyenne", haut: "Haute" };

const segmented = (name, options, labels, value) => {
  const wrap = el("div", { class: "segmented", role: "group" });
  const hidden = el("input", { type: "hidden", name, value });
  wrap.append(hidden, ...options.map((o) =>
    el("button", {
      type: "button", "aria-pressed": String(o === value),
      onclick: (e) => {
        hidden.value = o;
        wrap.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === e.currentTarget)));
      },
    }, labels[o])
  ));
  return wrap;
};

// Feuille de création / modification d'une tâche
const todoSheet = (todo, { defaultDate, onDone }) => openSheet((close) => {
  const isNew = !todo;
  const form = el("form", {
    onsubmit: async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(form));
      const body = { title: f.title.trim(), date: f.date, priorite: f.priorite, status: f.status || "a faire" };
      if (!body.title) return;
      try {
        if (isNew) await api("/todos/new", { method: "POST", body });
        else await api(`/todos/update/${todo.id_todo}`, { method: "PUT", body });
        close();
        toast(isNew ? "Tâche ajoutée" : "Tâche enregistrée");
        onDone();
      } catch (ex) { toast(ex.message, true); }
    },
  },
    el("h2", {}, isNew ? "Nouvelle tâche" : "Modifier la tâche"),
    el("label", { class: "field" }, el("span", {}, "Titre"),
      el("input", { class: "input", name: "title", required: true, maxlength: 255, value: todo?.titre || "" })),
    el("label", { class: "field" }, el("span", {}, "Date"),
      el("input", { class: "input", name: "date", type: "date", required: true, value: todo?.date || defaultDate || isoDay() })),
    el("div", { class: "field" }, el("span", {}, "Priorité"), segmented("priorite", PRIOS, PRIO_LABEL, todo?.priorite || "moyen")),
    isNew ? null : el("div", { class: "field" }, el("span", {}, "État"), segmented("status", STATUSES, STATUS_LABEL, todo.status)),
    el("div", { class: "actions" },
      isNew ? el("button", { class: "btn", type: "button", onclick: close }, "Annuler")
        : el("button", {
            class: "btn danger", type: "button",
            onclick: async () => {
              close();
              if (!(await confirmSheet("Supprimer cette tâche ?", "Supprimer"))) return;
              try { await api(`/todos/delete/${todo.id_todo}`, { method: "DELETE" }); toast("Tâche supprimée"); onDone(); }
              catch (ex) { toast(ex.message, true); }
            },
          }, "Supprimer"),
      el("button", { class: "btn primary", type: "submit" }, isNew ? "Ajouter" : "Enregistrer")
    )
  );
  return form;
});

const nextStatus = (s) => STATUSES[(STATUSES.indexOf(s) + 1) % STATUSES.length];

const todoItem = (t, reload) => {
  const today = isoDay();
  const late = t.status !== "terminé" && t.date < today;
  return el("li", { class: t.status === "terminé" ? "done" : "" },
    el("span", { class: "prio", "data-p": t.priorite, title: `Priorité ${PRIO_LABEL[t.priorite]}` }),
    el("button", {
      class: "check", "data-status": t.status,
      "aria-label": `${STATUS_LABEL[t.status]} — passer à ${STATUS_LABEL[nextStatus(t.status)]}`,
      onclick: async () => {
        try {
          await api(`/todos/update/${t.id_todo}`, {
            method: "PUT",
            body: { title: t.titre, date: t.date, priorite: t.priorite, status: nextStatus(t.status) },
          });
          reload();
        } catch (ex) { toast(ex.message, true); }
      },
    }, t.status === "terminé" ? icon("check") : null),
    el("button", { class: "row-main row-btn", onclick: () => todoSheet(t, { onDone: reload }), "aria-label": `Modifier ${t.titre}` },
      el("div", { class: "row-title" }, t.titre),
      el("div", { class: `row-sub${late ? " late-date" : ""}` },
        late ? `En retard · ${prettyDay(t.date)}` : prettyDay(t.date),
        t.status === "en cours" ? " · en cours" : "")
    )
  );
};

const groupTodos = (todos) => {
  const today = isoDay();
  const g = { late: [], today: [], soon: [], done: [] };
  for (const t of todos) {
    if (t.status === "terminé") g.done.push(t);
    else if (t.date < today) g.late.push(t);
    else if (t.date === today) g.today.push(t);
    else g.soon.push(t);
  }
  const rank = { haut: 0, moyen: 1, bas: 2 };
  const by = (a, b) => a.date.localeCompare(b.date) || rank[a.priorite] - rank[b.priorite];
  Object.values(g).forEach((l) => l.sort(by));
  g.done.reverse();
  return g;
};

route(/^#\/taches$/, "#/taches", async (root) => {
  const body = el("div", {}, loading());
  const reload = async () => {
    try {
      const g = groupTodos(await api("/todos"));
      const sections = [
        ["En retard", g.late], ["Aujourd'hui", g.today], ["À venir", g.soon], ["Terminées", g.done.slice(0, 15)],
      ].filter(([, l]) => l.length);
      setKids(body, 
        sections.length
          ? sections.map(([title, list]) => [el("h2", {}, title), el("ul", { class: "list panel" }, list.map((t) => todoItem(t, reload)))])
          : el("p", { class: "empty" }, "Aucune tâche. Ajoute la première avec le bouton +.")
      );
    } catch (e) { setKids(body, el("div", { class: "error-box" }, e.message)); }
  };
  root.append(
    head("Tâches",
      el("a", { class: "icon-btn", href: "#/calendrier", "aria-label": "Calendrier" }, icon("calendar")),
      el("button", { class: "icon-btn", "aria-label": "Nouvelle tâche", onclick: () => todoSheet(null, { onDone: reload }) }, icon("plus"))
    ),
    body
  );
  await reload();
});

/* ================= Calendrier ================= */
route(/^#\/calendrier$/, "#/taches", async (root) => {
  let todos = [];
  let cursor = new Date(); cursor.setDate(1);
  let selected = isoDay();
  const grid = el("div");
  const dayList = el("div");

  const drawDay = () => {
    const list = todos.filter((t) => t.date === selected);
    setKids(dayList, 
      el("div", { class: "section-link" },
        el("h2", {}, prettyDay(selected)),
        el("button", { class: "btn ghost", onclick: () => todoSheet(null, { defaultDate: selected, onDone: reload }) }, icon("plus"), "Ajouter")),
      list.length
        ? el("ul", { class: "list panel" }, list.map((t) => todoItem(t, reload)))
        : el("p", { class: "empty" }, "Rien de prévu ce jour-là.")
    );
  };

  const drawMonth = () => {
    const y = cursor.getFullYear(), m = cursor.getMonth();
    const first = new Date(y, m, 1);
    const offset = (first.getDay() + 6) % 7; // semaine commençant lundi
    const start = new Date(y, m, 1 - offset);
    const byDay = {};
    for (const t of todos) (byDay[t.date] ||= []).push(t);
    const today = isoDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const total = Math.ceil((offset + daysInMonth) / 7) * 7;
    const cells = [];
    for (let i = 0; i < total; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const iso = isoDay(d);
      const items = (byDay[iso] || []).filter((t) => t.status !== "terminé");
      cells.push(el("button", {
        class: ["cal-day", d.getMonth() !== m && "out", iso === today && "today"].filter(Boolean).join(" "),
        "aria-pressed": String(iso === selected),
        "aria-label": `${prettyDay(iso)}${items.length ? `, ${items.length} tâche(s)` : ""}`,
        onclick: () => { selected = iso; drawMonth(); drawDay(); },
      }, String(d.getDate()), el("span", { class: "cal-dots" }, items.slice(0, 3).map((t) => el("i", { "data-p": t.priorite })))));
    }
    setKids(grid, 
      el("div", { class: "cal-head" },
        el("button", { class: "icon-btn", "aria-label": "Mois précédent", onclick: () => { cursor.setMonth(m - 1); drawMonth(); } }, icon("chevL")),
        el("strong", {}, `${MONTHS[m]} ${y}`),
        el("button", { class: "icon-btn", "aria-label": "Mois suivant", onclick: () => { cursor.setMonth(m + 1); drawMonth(); } }, icon("chevR"))),
      el("div", { class: "cal-grid" },
        ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"].map((d) => el("div", { class: "cal-dow" }, d)),
        cells)
    );
  };

  const reload = async () => {
    try { todos = await api("/todos"); } catch (e) { toast(e.message, true); }
    drawMonth(); drawDay();
  };

  root.append(
    head("Calendrier", el("a", { class: "back", href: "#/taches" }, "Liste")),
    el("section", { class: "panel" }, grid),
    dayList
  );
  await reload();
});

/* ================= Notes ================= */
route(/^#\/notes$/, "#/notes", async (root) => {
  const list = el("div", {}, loading());
  const input = el("input", { class: "input", name: "name", placeholder: "Nouvelle note, ex. Courses", maxlength: 255, required: true });
  const form = el("form", {
    class: "inline-form",
    onsubmit: async (e) => {
      e.preventDefault();
      const name = input.value.trim();
      if (!name) return;
      try {
        const { noteId } = await api("/notes/new", { method: "POST", body: { name } });
        location.hash = `#/notes/${noteId}`;
      } catch (ex) { toast(ex.message, true); }
    },
  }, input, el("button", { class: "btn primary", type: "submit" }, "Créer"));

  root.append(head("Notes"), form, list);
  try {
    const notes = await api("/notes/getNotes");
    setKids(list, notes.length
      ? el("ul", { class: "list panel" }, notes.slice().reverse().map((n) =>
          el("li", {}, el("a", { href: `#/notes/${n.id_note}`, class: "row-main", style: { color: "inherit", textDecoration: "none" } },
            el("div", { class: "row-title" }, n.name)), icon("chevR"))))
      : el("p", { class: "empty" }, "Aucune note. Crée ta première liste ci-dessus."));
  } catch (e) { setKids(list, el("div", { class: "error-box" }, e.message)); }
});

route(/^#\/notes\/(\d+)$/, "#/notes", async (root, id) => {
  const note = await api(`/notes/${id}`);
  const title = el("h1", {}, note.name);
  const items = el("ul", { class: "list" });
  const input = el("input", { class: "input", placeholder: "Ajouter un élément", maxlength: 255, required: true });

  const reload = async () => {
    const fields = await api(`/notes/field/${id}`);
    setKids(items, ...(fields.length ? fields.map((f) => {
      const text = el("div", { class: "row-title" }, f.titre);
      return el("li", {},
        el("div", { class: "row-main" }, text),
        el("button", { class: "icon-btn", "aria-label": "Modifier", onclick: () => openSheet((close) => {
          const inp = el("input", { class: "input", value: f.titre, maxlength: 255, required: true });
          return el("form", { onsubmit: async (e) => {
            e.preventDefault();
            try { await api(`/notes/field/update/${f.id_field}`, { method: "PUT", body: { title: inp.value.trim() } }); close(); reload(); }
            catch (ex) { toast(ex.message, true); }
          } }, el("h2", {}, "Modifier l'élément"), el("label", { class: "field" }, inp),
            el("div", { class: "actions" }, el("button", { class: "btn", type: "button", onclick: close }, "Annuler"),
              el("button", { class: "btn primary", type: "submit" }, "Enregistrer")));
        }) }, icon("edit")),
        el("button", { class: "icon-btn", "aria-label": "Supprimer", onclick: async () => {
          try { await api(`/notes/field/delete/${f.id_field}`, { method: "DELETE" }); reload(); }
          catch (ex) { toast(ex.message, true); }
        } }, icon("trash"))
      );
    }) : [el("li", { class: "empty" }, "Liste vide pour l'instant.")]));
  };

  const menu = el("button", { class: "icon-btn", "aria-label": "Renommer ou supprimer la note", onclick: () => openSheet((close) => {
    const inp = el("input", { class: "input", value: note.name, maxlength: 255, required: true });
    return el("form", { onsubmit: async (e) => {
      e.preventDefault();
      try {
        await api(`/notes/update/${id}`, { method: "PUT", body: { name: inp.value.trim() } });
        note.name = inp.value.trim(); title.textContent = note.name; close(); toast("Note renommée");
      } catch (ex) { toast(ex.message, true); }
    } },
      el("h2", {}, "Note"),
      el("label", { class: "field" }, el("span", {}, "Nom"), inp),
      el("div", { class: "actions" },
        el("button", { class: "btn danger", type: "button", onclick: async () => {
          close();
          if (!(await confirmSheet(`Supprimer « ${note.name} » et tout son contenu ?`, "Supprimer"))) return;
          try { await api(`/notes/delete/${id}`, { method: "DELETE" }); toast("Note supprimée"); location.hash = "#/notes"; }
          catch (ex) { toast(ex.message, true); }
        } }, "Supprimer"),
        el("button", { class: "btn primary", type: "submit" }, "Renommer")));
  }) }, icon("edit"));

  root.append(
    el("header", { class: "screen-head" }, el("a", { class: "back", href: "#/notes" }, "‹ Notes"), el("span", { style: { flex: 1 } }), menu),
    el("div", { class: "screen-head" }, title),
    el("form", { class: "inline-form", onsubmit: async (e) => {
      e.preventDefault();
      const v = input.value.trim();
      if (!v) return;
      try { await api("/notes/new/field", { method: "POST", body: { title: v, id_note: Number(id) } }); input.value = ""; reload(); input.focus(); }
      catch (ex) { toast(ex.message, true); }
    } }, input, el("button", { class: "btn primary", type: "submit", "aria-label": "Ajouter" }, icon("plus"))),
    el("section", { class: "panel" }, items)
  );
  await reload();
});

/* ================= Lumières ================= */
// Limite les envois pendant qu'on fait glisser un curseur
const throttle = (fn, ms) => {
  let t = 0, timer = null, lastArgs;
  return (...args) => {
    lastArgs = args;
    const wait = ms - (Date.now() - t);
    if (wait <= 0) { t = Date.now(); fn(...args); }
    else if (!timer) timer = setTimeout(() => { timer = null; t = Date.now(); fn(...lastArgs); }, wait);
  };
};

const lightRow = ({ name, on, brightness, color, reachable = true, send }) => {
  const row = el("div", { class: `light${on ? " on" : ""}${reachable ? "" : " unreachable"}` });
  if (color) row.style.setProperty("--glow", color);
  const sw = el("button", {
    class: "switch", role: "switch", "aria-checked": String(on), "aria-label": `${name} ${on ? "allumée" : "éteinte"}`,
    disabled: !reachable,
    onclick: async () => {
      const next = sw.getAttribute("aria-checked") !== "true";
      sw.setAttribute("aria-checked", String(next));
      row.classList.toggle("on", next);
      try { await send({ on: next }); } catch (ex) {
        sw.setAttribute("aria-checked", String(!next)); row.classList.toggle("on", !next); toast(ex.message, true);
      }
    },
  });
  const sendBri = throttle((v) => send({ brightness: v }).catch((ex) => toast(ex.message, true)), 350);
  const sendColor = throttle((v) => send({ color: v }).catch((ex) => toast(ex.message, true)), 350);
  row.append(
    el("div", { class: "bulb" }, icon("bulb")),
    el("div", {}, el("div", { class: "row-title" }, name), reachable ? null : el("div", { class: "row-sub" }, "injoignable")),
    sw,
    el("div", { class: "controls" },
      brightness != null ? el("input", {
        type: "range", min: 1, max: 100, value: brightness, "aria-label": `Intensité ${name}`, disabled: !reachable,
        oninput: (e) => sendBri(Number(e.target.value)),
      }) : el("span", { style: { flex: 1 } }),
      color !== undefined ? el("input", {
        type: "color", value: color || "#ffd98a", "aria-label": `Couleur ${name}`, disabled: !reachable,
        oninput: (e) => { row.style.setProperty("--glow", e.target.value); sendColor(e.target.value); },
      }) : null
    )
  );
  return row;
};

const pairingPanel = ({ title, steps, button, onPair, extra }) => {
  const btn = el("button", { class: "btn primary", onclick: async () => {
    btn.disabled = true; btn.textContent = "Recherche…";
    try { await onPair(); } finally { btn.disabled = false; btn.textContent = button; }
  } }, button);
  return el("section", { class: "panel" }, el("h2", {}, title), el("p", { class: "hint" }, steps), extra || null, btn);
};

route(/^#\/lumieres$/, "#/lumieres", async (root) => {
  const body = el("div", {}, loading());
  root.append(head("Lumières", el("button", { class: "icon-btn", "aria-label": "Actualiser", onclick: () => reload() }, icon("refresh"))), body);

  const reload = async () => {
    let s;
    try { s = await api("/lights/status"); } catch (e) { setKids(body, el("div", { class: "error-box" }, e.message)); return; }
    const parts = [];

    // Philips Hue
    if (s.hue.paired && s.hue.reachable) {
      const anyOn = s.hue.lights.some((l) => l.on);
      parts.push(el("div", { class: "section-link" },
        el("h2", {}, "Philips Hue"),
        el("button", { class: "btn ghost", onclick: async () => {
          try { await api("/lights/hue/all", { method: "PUT", body: { on: !anyOn } }); reload(); }
          catch (ex) { toast(ex.message, true); }
        } }, anyOn ? "Tout éteindre" : "Tout allumer")));
      parts.push(el("section", { class: "panel" },
        s.hue.lights.length ? s.hue.lights.map((l) => lightRow({
          ...l, send: (state) => api(`/lights/hue/${l.id}`, { method: "PUT", body: state }),
        })) : el("p", { class: "empty" }, "Aucune lampe sur le pont.")));
    } else if (s.hue.paired) {
      parts.push(el("h2", {}, "Philips Hue"), el("div", { class: "error-box" }, s.hue.message || "Le pont Hue ne répond pas."));
    } else {
      parts.push(pairingPanel({
        title: "Philips Hue",
        steps: s.hue.message && !s.hue.reachable
          ? s.hue.message
          : "Appuie sur le bouton rond au centre du pont Hue, puis touche « Appairer » dans les 30 secondes.",
        button: "Appairer le pont",
        onPair: async () => {
          try { await api("/lights/hue/pair", { method: "POST", body: {} }); toast("Pont Hue appairé"); reload(); }
          catch (ex) { toast(ex.message, true); }
        },
      }));
    }

    // Nanoleaf
    if (s.nanoleaf.paired && s.nanoleaf.reachable) {
      parts.push(el("h2", {}, "Nanoleaf"), el("section", { class: "panel" }, lightRow({
        name: s.nanoleaf.name, on: s.nanoleaf.on, brightness: s.nanoleaf.brightness, color: s.nanoleaf.color,
        send: (state) => api("/lights/nanoleaf", { method: "PUT", body: state }),
      })));
    } else {
      const ipInput = el("input", { class: "input", placeholder: "Adresse IP (facultatif), ex. 192.168.1.40", inputmode: "decimal" });
      parts.push(pairingPanel({
        title: "Nanoleaf",
        steps: s.nanoleaf.message
          ? s.nanoleaf.message
          : "Maintiens le bouton marche du Nanoleaf 5 à 7 secondes jusqu'à ce que la LED clignote, puis touche « Appairer ». Le serveur cherche le panneau tout seul.",
        extra: el("label", { class: "field" }, ipInput),
        button: "Appairer le Nanoleaf",
        onPair: async () => {
          try {
            await api("/lights/nanoleaf/pair", { method: "POST", body: ipInput.value.trim() ? { ip: ipInput.value.trim() } : {} });
            toast("Nanoleaf appairé"); reload();
          } catch (ex) { toast(ex.message, true); }
        },
      }));
    }
    setKids(body, ...parts);
  };
  await reload();
});

/* ================= Pièces ================= */
route(/^#\/pieces$/, "#/", async (root) => {
  const list = el("div", {}, loading());
  const input = el("input", { class: "input", placeholder: "Nom de la pièce, ex. Salon", maxlength: 255, required: true });
  const reload = async () => {
    try {
      const rooms = await api("/rooms");
      setKids(list, rooms.length
        ? el("ul", { class: "list panel" }, rooms.map((r) => el("li", {}, icon("room"), el("div", { class: "row-main" }, r.name))))
        : el("p", { class: "empty" }, "Aucune pièce. Ajoute la première ci-dessus."));
    } catch (e) { setKids(list, el("div", { class: "error-box" }, e.message)); }
  };
  root.append(
    head("Pièces", el("a", { class: "back", href: "#/" }, "Accueil")),
    el("form", { class: "inline-form", onsubmit: async (e) => {
      e.preventDefault();
      const name = input.value.trim();
      if (!name) return;
      try { await api("/rooms/new", { method: "POST", body: { name } }); input.value = ""; toast("Pièce ajoutée"); reload(); }
      catch (ex) { toast(ex.message, true); }
    } }, input, el("button", { class: "btn primary", type: "submit" }, "Ajouter")),
    list
  );
  await reload();
});

/* ================= Administration ================= */
route(/^#\/admin$/, "#/", async (root) => {
  root.append(head("Utilisateurs", el("a", { class: "back", href: "#/" }, "Accueil")));
  if (me?.role !== "admin") {
    root.append(el("p", { class: "empty" }, "Réservé aux administrateurs."));
    return;
  }
  const list = el("div", {}, loading());
  root.append(list);
  const reload = async () => {
    const users = await api("/users");
    setKids(list, el("ul", { class: "list panel" }, users.map((u) =>
      el("li", {},
        el("div", { class: "row-main" },
          el("div", { class: "row-title" }, u.username, u.id === me.id ? " (toi)" : ""),
          el("div", { class: "row-sub" }, `${u.email} · ${u.role === "admin" ? "administrateur" : "utilisateur"}`)),
        el("button", { class: "icon-btn", "aria-label": `Modifier ${u.username}`, onclick: () => openSheet((close) => {
          const form = el("form", { onsubmit: async (e) => {
            e.preventDefault();
            const f = Object.fromEntries(new FormData(form));
            try { await api(`/users/update/${u.id}`, { method: "PUT", body: f }); close(); toast("Utilisateur enregistré"); reload(); }
            catch (ex) { toast(ex.message, true); }
          } },
            el("h2", {}, u.username),
            el("label", { class: "field" }, el("span", {}, "Pseudo"), el("input", { class: "input", name: "username", value: u.username, required: true })),
            el("label", { class: "field" }, el("span", {}, "Email"), el("input", { class: "input", name: "email", type: "email", value: u.email, required: true })),
            el("div", { class: "field" }, el("span", {}, "Rôle"), segmented("role", ["user", "admin"], { user: "Utilisateur", admin: "Administrateur" }, u.role)),
            el("div", { class: "actions" },
              u.id === me.id ? null : el("button", { class: "btn danger", type: "button", onclick: async () => {
                close();
                if (!(await confirmSheet(`Supprimer ${u.username} et toutes ses données ?`, "Supprimer"))) return;
                try { await api(`/users/delete/${u.id}`, { method: "DELETE" }); toast("Utilisateur supprimé"); reload(); }
                catch (ex) { toast(ex.message, true); }
              } }, "Supprimer"),
              el("button", { class: "btn primary", type: "submit" }, "Enregistrer")));
          return form;
        }) }, icon("edit"))
      ))));
  };
  try { await reload(); } catch (e) { setKids(list, el("div", { class: "error-box" }, e.message)); }
});

/* ================= Accueil ================= */
const greeting = () => {
  const h = new Date().getHours();
  return h < 5 ? "Bonne nuit" : h < 18 ? "Bonjour" : "Bonsoir";
};

route(/^#\/$/, "#/", async (root) => {
  const busSlot = el("div", {}, loading());
  const tasksSlot = el("div");
  const lightsSlot = el("div");

  root.append(
    el("header", { class: "screen-head" },
      el("p", { class: "greet", style: { flex: 1, margin: 0 } }, `${greeting()}${me?.username ? `, ${me.username}` : ""}`),
      el("button", { class: "icon-btn", "aria-label": "Se déconnecter", onclick: () => logout() }, icon("logout"))),
    el("div", { class: "section-link" }, el("h2", {}, "Prochain 118"), el("a", { href: "#/bus" }, "Tous les arrêts")),
    busSlot,
    tasksSlot,
    lightsSlot,
    el("h2", {}, "Aussi"),
    el("nav", { class: "nav-links" },
      el("a", { href: "#/calendrier" }, icon("calendar"), "Calendrier"),
      el("a", { href: "#/pieces" }, icon("room"), "Pièces"),
      me?.role === "admin" ? el("a", { href: "#/pc" }, icon("pc"), "PC") : null,
      me?.role === "admin" ? el("a", { href: "#/admin" }, icon("admin"), "Utilisateurs") : null)
  );

  const loadBus = async () => {
    try {
      const data = await api("/transport/118");
      const stop = data.stops.find((s) => s.id === favStop()) || data.stops[0];
      setKids(busSlot, busBoard(stop));
    } catch (e) { setKids(busSlot, el("div", { class: "error-box" }, e.message)); }
  };

  const loadTasks = async () => {
    try {
      const g = groupTodos(await api("/todos"));
      const list = [...g.late, ...g.today];
      setKids(tasksSlot, 
        el("div", { class: "section-link" }, el("h2", {}, "Aujourd'hui"), el("a", { href: "#/taches" }, "Toutes les tâches")),
        list.length
          ? el("ul", { class: "list panel" }, list.slice(0, 6).map((t) => todoItem(t, loadTasks)))
          : el("p", { class: "empty" }, g.soon.length ? `Rien pour aujourd'hui. Prochaine tâche : ${prettyDay(g.soon[0].date).toLowerCase()}.` : "Rien de prévu aujourd'hui.")
      );
    } catch {}
  };

  const loadLights = async () => {
    try {
      const s = await api("/lights/status");
      const chips = [];
      if (s.hue.paired && s.hue.reachable) {
        for (const l of s.hue.lights) {
          chips.push(el("button", { class: "chip", "aria-pressed": String(l.on), disabled: !l.reachable, onclick: async (e) => {
            const b = e.currentTarget; const next = b.getAttribute("aria-pressed") !== "true";
            b.setAttribute("aria-pressed", String(next));
            try { await api(`/lights/hue/${l.id}`, { method: "PUT", body: { on: next } }); }
            catch (ex) { b.setAttribute("aria-pressed", String(!next)); toast(ex.message, true); }
          } }, el("span", { class: "dot" }), l.name));
        }
      }
      if (s.nanoleaf.paired && s.nanoleaf.reachable) {
        chips.push(el("button", { class: "chip", "aria-pressed": String(s.nanoleaf.on), onclick: async (e) => {
          const b = e.currentTarget; const next = b.getAttribute("aria-pressed") !== "true";
          b.setAttribute("aria-pressed", String(next));
          try { await api("/lights/nanoleaf", { method: "PUT", body: { on: next } }); }
          catch (ex) { b.setAttribute("aria-pressed", String(!next)); toast(ex.message, true); }
        } }, el("span", { class: "dot" }), s.nanoleaf.name));
      }
      setKids(lightsSlot, 
        el("div", { class: "section-link" }, el("h2", {}, "Lumières"), el("a", { href: "#/lumieres" }, chips.length ? "Réglages" : "Configurer")),
        chips.length ? el("div", { class: "quick-lights" }, chips) : el("p", { class: "empty" }, "Aucune lampe appairée pour l'instant.")
      );
    } catch {}
  };

  await Promise.all([loadBus(), loadTasks(), loadLights()]);
  return every(30000, loadBus);
});

/* ================= PC (agent Windows) ================= */
const SVG_NS = "http://www.w3.org/2000/svg";
const svg = (tag, attrs = {}, ...children) => {
  const n = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, String(v));
  for (const c of children.flat()) if (c != null) n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return n;
};

const tempLevel = (t) => (t == null ? "na" : t >= 80 ? "hot" : t >= 65 ? "warm" : "cool");
const fmt = (v, unit = "", digits = 0) => (v == null ? "–" : `${Number(v).toFixed(digits)}${unit}`);
const ago = (iso) => {
  if (!iso) return "jamais";
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  return h < 24 ? `il y a ${h} h` : `le ${new Date(iso).toLocaleDateString("fr-FR")}`;
};

// Jauge en arc : 20 °C à gauche, 100 °C à droite
const gauge = (label, temp, sub) => {
  const R = 52, CX = 64, CY = 64, START = Math.PI * 0.85, END = Math.PI * 2.15;
  const pt = (a) => [CX + R * Math.cos(a), CY + R * Math.sin(a)];
  const arc = (a0, a1) => {
    const [x0, y0] = pt(a0), [x1, y1] = pt(a1);
    return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${R} ${R} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  };
  const ratio = temp == null ? 0 : Math.max(0, Math.min(1, (temp - 20) / 80));
  return el("figure", { class: `gauge ${tempLevel(temp)}` },
    svg("svg", { viewBox: "0 0 128 104", "aria-hidden": "true" },
      svg("path", { d: arc(START, END), class: "g-track" }),
      ratio > 0.005 ? svg("path", { d: arc(START, START + (END - START) * ratio), class: "g-fill" }) : null),
    el("figcaption", {},
      el("span", { class: "g-temp" }, temp == null ? "–" : Math.round(temp), el("small", {}, "°C")),
      el("span", { class: "g-label" }, label),
      el("span", { class: "g-sub" }, sub))
  );
};

// Courbes des températures CPU / GPU sur 24 h
const historyChart = (points) => {
  if (points.length < 2) return el("p", { class: "empty" }, "L'historique se remplit dès que le PC est allumé.");
  const W = 340, H = 150, L = 30, B = 20, T = 8, Rr = 6;
  const t0 = Date.now() - 24 * 3600e3, t1 = Date.now();
  const temps = points.flatMap((p) => [p.cpuTemp, p.gpuTemp]).filter((v) => v != null);
  const lo = Math.max(0, Math.floor((Math.min(...temps) - 5) / 10) * 10);
  const hi = Math.min(110, Math.ceil((Math.max(...temps) + 5) / 10) * 10);
  const x = (t) => L + ((t - t0) / (t1 - t0)) * (W - L - Rr);
  const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const line = (key) => {
    let d = "", prev = null;
    for (const p of points) {
      if (p[key] == null) { prev = null; continue; }
      const gap = prev && p.t - prev.t > 5 * 60e3; // PC éteint : on coupe la ligne
      d += `${!prev || gap ? "M" : "L"}${x(p.t).toFixed(1)} ${y(p[key]).toFixed(1)} `;
      prev = p;
    }
    return d;
  };
  const grid = [];
  for (let v = lo; v <= hi; v += 10) {
    grid.push(svg("line", { x1: L, x2: W - Rr, y1: y(v), y2: y(v), class: "c-grid" }),
      svg("text", { x: L - 6, y: y(v) + 4, class: "c-axis", "text-anchor": "end" }, v));
  }
  for (let h = 24; h >= 0; h -= 6) {
    const t = t1 - h * 3600e3;
    grid.push(svg("text", { x: x(t), y: H - 4, class: "c-axis", "text-anchor": "middle" },
      h === 0 ? "maint." : `${pad(new Date(t).getHours())} h`));
  }
  return el("figure", { class: "chart" },
    svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Températures CPU et GPU sur 24 heures" },
      grid,
      svg("path", { d: line("gpuTemp"), class: "c-line c-gpu" }),
      svg("path", { d: line("cpuTemp"), class: "c-line c-cpu" })),
    el("figcaption", { class: "legend" },
      el("span", { class: "k-cpu" }, "CPU"), el("span", { class: "k-gpu" }, "Carte graphique"), el("span", {}, "°C, moyenne par minute")));
};

const PRESETS = [
  ["Blanc chaud", "#ffc98a"], ["Blanc", "#ffffff"], ["Bleu", "#2f6bff"], ["Cyan", "#18d6ff"],
  ["Violet", "#8f4dff"], ["Rose", "#ff3d9a"], ["Rouge", "#ff2020"], ["Vert", "#1ed760"], ["Orange", "#ff7a00"],
];

route(/^#\/pc$/, "#/pc", async (root) => {
  root.append(head("PC"));
  if (me?.role !== "admin") {
    root.append(el("p", { class: "empty" }, "Réservé aux administrateurs."));
    return;
  }
  const statusLine = el("p", { class: "pc-state" }, "Connexion au PC…");
  const gauges = el("div", { class: "gauges" });
  const details = el("div");
  const chartSlot = el("section", { class: "panel" }, loading());
  const fansSlot = el("div");
  const lightSlot = el("div");
  root.append(statusLine, gauges, details,
    el("h2", {}, "Températures sur 24 h"), chartSlot,
    fansSlot, lightSlot);

  let fanInfo = null, lighting = null, online = false;

  const drawStatus = (s) => {
    online = s.online;
    if (!s.configured) {
      setKids(statusLine, el("span", { class: "dot-off" }), "Agent du PC pas encore installé.");
      return;
    }
    if (!s.online) {
      setKids(statusLine, el("span", { class: "dot-off" }), `PC éteint · dernière mesure ${ago(s.lastSeen)}`);
      setKids(gauges); setKids(details);
      return;
    }
    const st = s.status;
    setKids(statusLine, el("span", { class: "dot-on" }), `${st.host} · allumé depuis ${Math.floor(st.uptimeSeconds / 3600)} h ${pad(Math.floor(st.uptimeSeconds % 3600 / 60))}`);
    setKids(gauges,
      gauge("Processeur", st.cpu?.temp, `${fmt(st.cpu?.load, " %")} · ${fmt(st.cpu?.power, " W")}`),
      st.gpu ? gauge("Carte graphique", st.gpu.temp, `${fmt(st.gpu.load, " %")} · ${fmt(st.gpu.power, " W")}`) : null);

    const rows = [
      ["Processeur", st.cpu?.name, `${fmt(st.cpu?.clock, " MHz")} · cœur le plus chaud ${fmt(st.cpu?.tempMax, " °C")}`],
      st.gpu && ["Carte graphique", st.gpu.name,
        `point chaud ${fmt(st.gpu.hotspot, " °C")} · VRAM ${fmt(st.gpu.vramUsedMb / 1024, " Go", 1)} / ${fmt(st.gpu.vramTotalMb / 1024, " Go", 0)} · ventilo ${fmt(st.gpu.fanRpm, " tr/min")}`],
      ["Mémoire", `${fmt(st.memory?.usedGb, " Go", 1)} / ${fmt(st.memory?.totalGb, " Go", 0)}`, `${fmt(st.memory?.load, " %")} utilisée`],
      ...(st.storage || []).map((d) => ["SSD", d.name, `${fmt(d.temp, " °C")} · ${fmt(d.usedPercent, " % plein")}`]),
      ...(st.coolers || []).map((c) => ["Refroidissement", c.name, c.sensors.map((x) => `${x.name} ${x.value}`).join(" · ")]),
    ].filter(Boolean);
    setKids(details, el("ul", { class: "list panel" }, rows.map(([k, v, sub]) =>
      el("li", {}, el("div", { class: "row-main" },
        el("div", { class: "row-sub" }, k), el("div", { class: "row-title" }, v || "–"), el("div", { class: "row-sub" }, sub))))));
    drawFans(st);
  };

  const drawFans = (st) => {
    const fans = st?.board?.fans || [];
    const profile = fanInfo?.profile || st?.fanProfile || "auto";
    const profiles = fanInfo?.profiles || [{ id: "auto", label: "Auto (BIOS)" }, { id: "silencieux", label: "Silencieux" }, { id: "normal", label: "Normal" }, { id: "performance", label: "Performance" }];
    setKids(fansSlot,
      el("h2", {}, "Ventilation"),
      el("section", { class: "panel" },
        el("div", { class: "segmented", role: "group", "aria-label": "Profil des ventilateurs" },
          profiles.map((p) => el("button", {
            type: "button", "aria-pressed": String(p.id === profile), disabled: !online,
            onclick: async () => {
              try {
                await api("/pc/fans", { method: "POST", body: { profile: p.id } });
                fanInfo = { ...(fanInfo || {}), profile: p.id, profiles };
                drawFans(st); toast(`Profil ${p.label.toLowerCase()} appliqué`);
              } catch (e) { toast(e.message, true); }
            },
          }, p.label))),
        el("p", { class: "hint" }, profile === "auto"
          ? "La carte mère gère ses ventilateurs selon le BIOS."
          : "Les ventilateurs de la carte mère suivent la température du processeur (jamais sous 35 %, 100 % au-delà de 90 °C)."),
        fans.length
          ? el("ul", { class: "list" }, fans.map((f) => el("li", {}, icon("fan"),
              el("div", { class: "row-main" }, el("div", { class: "row-title" }, f.name),
                el("div", { class: "row-sub" }, `${fmt(f.rpm, " tr/min")}${f.percent != null ? ` · ${fmt(f.percent, " %")}` : ""}`)))))
          : el("p", { class: "empty" }, online ? "Aucun ventilateur détecté sur la carte mère." : "PC éteint."),
        el("p", { class: "small" }, "Pompe et ventilateurs de l'AIO : gérés par les profils d'iCUE.")));
  };

  const drawLighting = () => {
    const l = lighting;
    const colorInput = el("input", { type: "color", value: l?.color || "#ffffff", "aria-label": "Couleur personnalisée" });
    const bri = el("input", { type: "range", min: 5, max: 100, value: l?.brightness ?? 100, "aria-label": "Intensité" });
    const apply = async (color) => {
      try {
        const r = await api("/pc/lighting", { method: "POST", body: { mode: "color", color, brightness: Number(bri.value) } });
        lighting = { ...(lighting || {}), mode: "color", color, brightness: Number(bri.value) };
        if (r.errors?.length) toast(r.errors.join(" · "), true); else toast("Éclairage appliqué");
        drawLighting();
      } catch (e) { toast(e.message, true); }
    };
    const devices = [
      ...(l?.corsair?.devices || []).map((d) => [d.model, `Corsair · ${d.type}${d.battery != null ? ` · batterie ${d.battery} %` : ""}`]),
      ...(l?.aura?.devices || []).map((d) => [d.name, `ASUS Aura · ${d.lights} zones`]),
    ];
    setKids(lightSlot,
      el("h2", {}, "Éclairage"),
      el("section", { class: "panel" },
        el("p", { class: "hint" }, !online ? "PC éteint."
          : l?.mode === "color" ? "Couleur imposée depuis l'app sur Corsair et la carte mère."
          : "Les profils d'iCUE et d'Armoury Crate sont actifs."),
        el("div", { class: "swatches" },
          PRESETS.map(([name, hex]) => el("button", {
            class: "swatch", style: { background: hex }, "aria-label": name, title: name, disabled: !online,
            "aria-pressed": String(l?.mode === "color" && l?.color?.toLowerCase() === hex),
            onclick: () => apply(hex),
          })),
          el("label", { class: "swatch custom", title: "Autre couleur" }, colorInput)),
        el("label", { class: "field" }, el("span", {}, "Intensité"), bri),
        el("div", { class: "actions-row" },
          el("button", { class: "btn", disabled: !online, onclick: () => apply("#000000") }, "Éteindre les LED"),
          el("button", { class: "btn ghost", disabled: !online || l?.mode !== "color", onclick: async () => {
            try { await api("/pc/lighting", { method: "POST", body: { mode: "auto" } }); lighting = { ...(lighting || {}), mode: "auto" }; toast("Profils iCUE et Armoury Crate rétablis"); drawLighting(); }
            catch (e) { toast(e.message, true); }
          } }, "Revenir aux profils")),
        devices.length ? el("ul", { class: "list" }, devices.map(([n, sub]) =>
          el("li", {}, el("div", { class: "row-main" }, el("div", { class: "row-title" }, n), el("div", { class: "row-sub" }, sub))))) : null,
        l && l.corsair && !l.corsair.connected ? el("p", { class: "small" }, `iCUE : ${l.corsair.state}`) : null,
        l && l.aura && !l.aura.available ? el("p", { class: "small" }, `ASUS : ${l.aura.state}`) : null));
    colorInput.addEventListener("change", () => apply(colorInput.value));
    bri.addEventListener("change", () => { if (lighting?.mode === "color") apply(lighting.color); });
  };

  const loadStatus = async () => {
    try { drawStatus(await api("/pc/status")); } catch (e) { setKids(statusLine, e.message); }
  };
  const loadHistory = async () => {
    try { setKids(chartSlot, historyChart(await api("/pc/history?hours=24"))); }
    catch (e) { setKids(chartSlot, el("div", { class: "error-box" }, e.message)); }
  };
  const loadControls = async () => {
    if (!online) { drawLighting(); return; }
    const [f, l] = await Promise.allSettled([api("/pc/fans"), api("/pc/lighting")]);
    if (f.status === "fulfilled") fanInfo = f.value;
    lighting = l.status === "fulfilled" ? l.value : null;
    drawLighting();
  };

  await loadStatus();
  await Promise.all([loadHistory(), loadControls()]);
  const stop1 = every(5000, loadStatus);
  const stop2 = every(60000, loadHistory);
  return () => { stop1(); stop2(); };
});

/* ================= Démarrage ================= */
window.addEventListener("hashchange", navigate);
navigate();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
