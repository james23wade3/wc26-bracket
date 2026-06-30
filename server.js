"use strict";
const express = require("express");
const fs = require("fs");
const path = require("path");
const BR = require("./bracket-data.js");

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "state.json");
const EDIT_CODE = process.env.EDIT_CODE || "";    // optional passphrase to edit picks
const ADMIN_CODE = process.env.ADMIN_CODE || "";  // optional passphrase to set results manually
const AUTO_ENABLED = process.env.ENABLE_AUTO_RESULTS !== "0"; // default on
const POLL_MS = Math.max(60000, parseInt(process.env.POLL_MS || "300000", 10));

// ---- derived structure ----
const fixed = {}; BR.R0.forEach(r => fixed[r[0]] = [r[1], r[2]]);
const roundOf = {}; BR.COLS.forEach((c, i) => c.forEach(id => roundOf[id] = i));
const ALL = BR.COLS.flat();
const VALID_TEAMS = new Set(Object.keys(BR.T));

// ---- persistence (atomic JSON file) ----
let state = { picks: { andrew: {}, sam: {} }, manualActuals: {}, tiebreak: { andrew: null, sam: null }, finalGoals: null, updatedAt: 0 };
function load() {
  try {
    const j = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    state = j;
  } catch (e) { /* fresh */ }
  state.picks = state.picks || {};
  state.picks.andrew = state.picks.andrew || {};
  state.picks.sam = state.picks.sam || {};
  state.manualActuals = state.manualActuals || {};
  state.tiebreak = state.tiebreak || { andrew: null, sam: null };
  if (state.finalGoals === undefined) state.finalGoals = null;
}
function save() {
  state.updatedAt = Date.now();
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DATA_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(state));
  fs.renameSync(tmp, DATA_FILE);
}
fs.mkdirSync(DATA_DIR, { recursive: true });
load();

// ---- bracket helpers ----
function participants(id, actuals) {
  if (fixed[id]) return [fixed[id][0], fixed[id][1]];
  const k = BR.KIDS[id];
  return [actuals[k[0]] || null, actuals[k[1]] || null];
}
// Validate/clean a player's picks so a winner is always one of that match's feeders.
function normalizePicks(raw) {
  const out = {};
  for (let r = 0; r < BR.COLS.length; r++) {
    for (const id of BR.COLS[r]) {
      let a, b;
      if (fixed[id]) { a = fixed[id][0]; b = fixed[id][1]; }
      else { const k = BR.KIDS[id]; a = out[k[0]] || null; b = out[k[1]] || null; }
      const w = raw[id];
      if (w && VALID_TEAMS.has(w) && (w === a || w === b)) out[id] = w;
    }
  }
  return out;
}

// ---- actual results (auto from ESPN + manual override) ----
let autoPairResults = []; // [{teams:[code,code], winner:code}]
let lastPoll = 0, lastPollOk = false;

function computeActuals() {
  const actuals = {};
  for (let r = 0; r < BR.COLS.length; r++) {
    for (const id of BR.COLS[r]) {
      const [a, b] = participants(id, actuals);
      const manual = state.manualActuals[id];
      if (manual && VALID_TEAMS.has(manual)) { actuals[id] = manual; continue; }
      if (a && b) {
        const hit = autoPairResults.find(pr =>
          (pr.teams[0] === a && pr.teams[1] === b) || (pr.teams[0] === b && pr.teams[1] === a));
        if (hit && (hit.winner === a || hit.winner === b)) actuals[id] = hit.winner;
      }
    }
  }
  return actuals;
}

function scoreFor(player, actuals) {
  let points = 0, correct = 0;
  for (const id of ALL) {
    if (actuals[id] && state.picks[player][id]) {
      if (state.picks[player][id] === actuals[id]) {
        points += BR.ROUND_WEIGHTS[roundOf[id]];
        correct++;
      }
    }
  }
  return { points, correct };
}

// Who's winning the pool once the Final is decided (with tiebreaker).
function poolResult(actuals, scores) {
  if (!actuals[BR.CHAMP]) return null;
  if (scores.andrew.points !== scores.sam.points) {
    return { leader: scores.andrew.points > scores.sam.points ? "andrew" : "sam", by: "points" };
  }
  // tie on points -> closest total-goals guess for the final
  if (state.finalGoals == null) return { leader: "tie", by: "pending" };
  const da = state.tiebreak.andrew == null ? Infinity : Math.abs(state.tiebreak.andrew - state.finalGoals);
  const ds = state.tiebreak.sam == null ? Infinity : Math.abs(state.tiebreak.sam - state.finalGoals);
  if (da === ds) return { leader: "tie", by: "tiebreak" };
  return { leader: da < ds ? "andrew" : "sam", by: "tiebreak" };
}

// ---- ESPN keyless scoreboard poller ----
const ESPN = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=";
const NAME_TO_CODE = (function () {
  const m = {};
  const add = (code, names) => names.forEach(n => m[n.toUpperCase()] = code);
  Object.keys(BR.T).forEach(c => { m[c] = c; }); // identity for FIFA codes
  add("GER", ["Germany"]); add("PAR", ["Paraguay"]); add("FRA", ["France"]);
  add("SWE", ["Sweden"]); add("RSA", ["South Africa", "RSA"]); add("CAN", ["Canada"]);
  add("NED", ["Netherlands", "Holland"]); add("MAR", ["Morocco"]);
  add("BRA", ["Brazil"]); add("JPN", ["Japan"]);
  add("CIV", ["Ivory Coast", "Cote d'Ivoire", "Côte d'Ivoire", "Côte d’Ivoire", "Cote d’Ivoire", "IVC"]);
  add("NOR", ["Norway"]); add("MEX", ["Mexico"]); add("ECU", ["Ecuador"]);
  add("ENG", ["England"]); add("COD", ["DR Congo", "Congo DR", "DR Congo (Kinshasa)", "Democratic Republic of the Congo", "Congo Democratic Republic", "CGO", "DRC"]);
  add("POR", ["Portugal"]); add("CRO", ["Croatia"]); add("ESP", ["Spain"]);
  add("AUT", ["Austria"]); add("USA", ["United States", "USA", "United States of America"]);
  add("BIH", ["Bosnia & Herzegovina", "Bosnia and Herzegovina", "Bosnia-Herzegovina", "Bosnia & Herz."]);
  add("BEL", ["Belgium"]); add("SEN", ["Senegal"]); add("ARG", ["Argentina"]);
  add("CPV", ["Cape Verde", "Cabo Verde"]); add("AUS", ["Australia"]); add("EGY", ["Egypt"]);
  add("SUI", ["Switzerland"]); add("ALG", ["Algeria"]); add("COL", ["Colombia"]); add("GHA", ["Ghana"]);
  return m;
})();
function codeOf(competitor) {
  const t = competitor.team || {};
  const cand = [t.abbreviation, t.displayName, t.shortDisplayName, t.name, t.location].filter(Boolean);
  for (const c of cand) { const code = NAME_TO_CODE[String(c).toUpperCase()]; if (code) return code; }
  return null;
}
function tournamentDates() {
  const out = [];
  const start = Date.UTC(2026, 5, 28), end = Date.UTC(2026, 6, 19);
  for (let t = start; t <= end; t += 86400000) {
    const d = new Date(t);
    out.push("" + d.getUTCFullYear() +
      String(d.getUTCMonth() + 1).padStart(2, "0") +
      String(d.getUTCDate()).padStart(2, "0"));
  }
  return out;
}
async function fetchJson(url, ms) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), ms || 8000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "wc26-bracket" } });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) { return null; } finally { clearTimeout(to); }
}
async function poll() {
  if (!AUTO_ENABLED) return;
  const found = [];
  let okAny = false;
  for (const d of tournamentDates()) {
    const j = await fetchJson(ESPN + d, 8000);
    if (!j) continue;
    okAny = true;
    for (const ev of (j.events || [])) {
      const comp = ev.competitions && ev.competitions[0];
      if (!comp) continue;
      const done = comp.status && comp.status.type && comp.status.type.completed;
      if (!done) continue;
      const cs = comp.competitors || [];
      if (cs.length !== 2) continue;
      const t0 = codeOf(cs[0]), t1 = codeOf(cs[1]);
      if (!t0 || !t1 || t0 === t1) continue;
      let winner = null;
      if (cs[0].winner === true) winner = t0;
      else if (cs[1].winner === true) winner = t1;
      else {
        const s0 = parseInt(cs[0].score, 10), s1 = parseInt(cs[1].score, 10);
        if (!isNaN(s0) && !isNaN(s1) && s0 !== s1) winner = s0 > s1 ? t0 : t1;
      }
      if (winner) found.push({ teams: [t0, t1], winner });
    }
  }
  lastPoll = Date.now();
  lastPollOk = okAny;
  if (okAny) autoPairResults = found;
}

// ---- API ----
const app = express();
app.use(express.json({ limit: "256kb" }));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/bracket-data.js", (req, res) => {
  res.type("application/javascript");
  res.sendFile(path.join(__dirname, "bracket-data.js"));
});

function publicState() {
  const actuals = computeActuals();
  const scores = { andrew: scoreFor("andrew", actuals), sam: scoreFor("sam", actuals) };
  return {
    picks: state.picks,
    actuals,
    scores,
    tiebreak: state.tiebreak,
    finalGoals: state.finalGoals,
    pool: poolResult(actuals, scores),
    weights: BR.ROUND_WEIGHTS,
    decided: Object.keys(actuals).length,
    config: {
      autoEnabled: AUTO_ENABLED,
      requireEditCode: !!EDIT_CODE,
      requireAdminCode: !!ADMIN_CODE,
      lastPoll, lastPollOk
    },
    updatedAt: state.updatedAt
  };
}

app.get("/api/state", (req, res) => res.json(publicState()));

app.post("/api/picks", (req, res) => {
  const { player, picks, code, tiebreak } = req.body || {};
  if (player !== "andrew" && player !== "sam") return res.status(400).json({ error: "bad player" });
  if (EDIT_CODE && code !== EDIT_CODE) return res.status(401).json({ error: "bad code" });
  if (tiebreak !== undefined) {
    const n = parseInt(tiebreak, 10);
    state.tiebreak[player] = (tiebreak === null || isNaN(n)) ? null : Math.max(0, Math.min(40, n));
  }
  const actuals = computeActuals();
  const incoming = normalizePicks(picks || {});
  // Lock: never change a pick for a match that's already decided.
  const merged = {};
  for (const id of ALL) {
    if (actuals[id]) merged[id] = state.picks[player][id] || incoming[id] || undefined;
    else if (incoming[id]) merged[id] = incoming[id];
  }
  Object.keys(merged).forEach(k => merged[k] === undefined && delete merged[k]);
  state.picks[player] = normalizePicks(merged);
  save();
  res.json(publicState());
});

app.post("/api/admin/actual", (req, res) => {
  const { matchId, winner, code } = req.body || {};
  if (ADMIN_CODE && code !== ADMIN_CODE) return res.status(401).json({ error: "bad code" });
  if (!ALL.includes(matchId)) return res.status(400).json({ error: "bad match" });
  if (winner === null || winner === "") {
    delete state.manualActuals[matchId];
  } else {
    if (!VALID_TEAMS.has(winner)) return res.status(400).json({ error: "bad team" });
    state.manualActuals[matchId] = winner;
  }
  save();
  res.json(publicState());
});

app.post("/api/admin/refresh", async (req, res) => {
  const { code } = req.body || {};
  if (ADMIN_CODE && code !== ADMIN_CODE) return res.status(401).json({ error: "bad code" });
  await poll();
  res.json(publicState());
});

app.post("/api/admin/finalgoals", (req, res) => {
  const { goals, code } = req.body || {};
  if (ADMIN_CODE && code !== ADMIN_CODE) return res.status(401).json({ error: "bad code" });
  if (goals === null || goals === "") { state.finalGoals = null; }
  else {
    const n = parseInt(goals, 10);
    if (isNaN(n) || n < 0) return res.status(400).json({ error: "bad goals" });
    state.finalGoals = n;
  }
  save();
  res.json(publicState());
});

app.get("/healthz", (req, res) => res.send("ok"));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

app.listen(PORT, () => console.log("WC26 bracket on :" + PORT));
poll();
setInterval(poll, POLL_MS);
