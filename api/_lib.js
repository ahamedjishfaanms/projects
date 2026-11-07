// Shared helpers for the API routes.
// Files starting with "_" inside /api are NOT exposed as routes on Vercel.
import crypto from "node:crypto";
import fs from "node:fs/promises";

// ---------- Seed data (shown until you connect a database) ----------
export const SEED_PROJECTS = [
  {
    id: "heyticket",
    name: "Hey Ticket",
    url: "https://heyticket.beingtechy.org/",
    description:
      "Create an event, issue QR tickets automatically, send reminders and scan people in at the door — all from one tool.",
    pricing: "free",
    price: "",
    tags: ["Events", "QR tickets", "Check-in"],
    thumbnail: "",
    featured: true,
    order: 0,
    createdAt: "2026-11-08T00:00:00.000Z",
  },
  {
    id: "pocket-ledger",
    name: "Pocket Ledger",
    url: "https://ledger.beingtechy.org/",
    description:
      "Track income, expenses and budgets, and spot overspending early. Installable as an app on your phone.",
    pricing: "free",
    price: "",
    tags: ["Finance", "Budgeting", "PWA"],
    thumbnail: "",
    featured: false,
    order: 1,
    createdAt: "2026-11-08T00:00:00.000Z",
  },
];

const KEY = "beingtechy:projects";

// ---------- Storage ----------
// 1) Upstash Redis (Vercel Marketplace → Upstash → "Redis") sets these env vars automatically.
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
// 2) Local JSON file (used by `npm run dev`).
const LOCAL_FILE = process.env.LOCAL_DATA_FILE;

export function storageMode() {
  if (REDIS_URL && REDIS_TOKEN) return "redis";
  if (LOCAL_FILE) return "file";
  return "seed"; // read-only
}

async function redis(command) {
  const r = await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  const data = await r.json();
  if (data.error) throw new Error("Redis: " + data.error);
  return data.result;
}

export async function loadProjects() {
  const mode = storageMode();
  if (mode === "redis") {
    const raw = await redis(["GET", KEY]);
    if (raw == null) {
      await redis(["SET", KEY, JSON.stringify(SEED_PROJECTS)]);
      return structuredClone(SEED_PROJECTS);
    }
    return JSON.parse(raw);
  }
  if (mode === "file") {
    try {
      return JSON.parse(await fs.readFile(LOCAL_FILE, "utf8"));
    } catch {
      await fs.writeFile(LOCAL_FILE, JSON.stringify(SEED_PROJECTS, null, 2));
      return structuredClone(SEED_PROJECTS);
    }
  }
  return structuredClone(SEED_PROJECTS);
}

export async function saveProjects(list) {
  const mode = storageMode();
  if (mode === "redis") return redis(["SET", KEY, JSON.stringify(list)]);
  if (mode === "file") return fs.writeFile(LOCAL_FILE, JSON.stringify(list, null, 2));
  const err = new Error(
    "No database connected. Add Upstash Redis to this Vercel project (Storage tab) so changes can be saved."
  );
  err.status = 503;
  throw err;
}

// ---------- Auth (stateless signed token, valid 7 days) ----------
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function secret() {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) {
    const err = new Error("ADMIN_PASSWORD is not set in the environment variables.");
    err.status = 500;
    throw err;
  }
  return process.env.AUTH_SECRET || pw;
}

function sign(payload) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("hex");
}

export function checkPassword(input) {
  const pw = process.env.ADMIN_PASSWORD || "";
  const a = Buffer.from(String(input || ""));
  const b = Buffer.from(pw);
  if (!pw || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function issueToken() {
  const exp = String(Date.now() + TOKEN_TTL_MS);
  return `${exp}.${sign(exp)}`;
}

export function isAuthed(req) {
  const header = req.headers["authorization"] || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const expected = sign(exp);
  if (expected.length !== sig.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

// ---------- HTTP helpers ----------
export function send(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

export async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

export function handleError(res, e) {
  send(res, e.status || 500, { error: e.message || "Something went wrong" });
}

// ---------- Validation ----------
const PRICING = ["free", "paid", "freemium"];

export function cleanProject(input, existing = {}) {
  const out = { ...existing };
  const str = (v, max) => String(v ?? "").trim().slice(0, max);

  if ("name" in input) out.name = str(input.name, 80);
  if ("url" in input) out.url = normalizeUrl(input.url);
  if ("description" in input) out.description = str(input.description, 400);
  if ("pricing" in input) out.pricing = PRICING.includes(input.pricing) ? input.pricing : "free";
  if ("price" in input) out.price = str(input.price, 40);
  if ("thumbnail" in input) out.thumbnail = input.thumbnail ? normalizeUrl(input.thumbnail) : "";
  if ("featured" in input) out.featured = Boolean(input.featured);
  if ("tags" in input) {
    const tags = Array.isArray(input.tags) ? input.tags : String(input.tags).split(",");
    out.tags = tags.map((t) => str(t, 30)).filter(Boolean).slice(0, 8);
  }
  if (out.pricing === "free") out.price = "";

  if (!out.name) throw Object.assign(new Error("Project name is required."), { status: 400 });
  if (!out.url) throw Object.assign(new Error("A valid website URL is required."), { status: 400 });
  return out;
}

export function normalizeUrl(v) {
  let s = String(v || "").trim();
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  try {
    const u = new URL(s);
    if (!["http:", "https:"].includes(u.protocol)) return "";
    return u.toString();
  } catch {
    return "";
  }
}

export function slugify(name) {
  return (
    String(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "project"
  );
}
