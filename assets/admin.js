import { frameHTML, loadThumb, initTheme, esc, pricingLabel, hostOf, toast } from "./common.js";

initTheme(document.getElementById("theme"));

const $ = (id) => document.getElementById(id);
const TOKEN_KEY = "bt-admin-token";
let token = "";
try { token = localStorage.getItem(TOKEN_KEY) || ""; } catch {}

let projects = [];
let editingId = null;
let pricing = "free";

// ---------- API ----------
async function api(path, opts = {}) {
  const r = await fetch(path, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && path !== "/api/login") { logout(); throw new Error("Session expired — please log in again."); }
  if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
  return data;
}

// ---------- Auth ----------
function showLogin() {
  $("login-view").hidden = false; $("dash-view").hidden = true; $("logout").hidden = true;
  setTimeout(() => $("pw").focus(), 50);
}
function logout() {
  token = "";
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
  showLogin();
}
$("logout").onclick = logout;

$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.submitter; btn.disabled = true; $("login-err").textContent = "";
  try {
    const data = await api("/api/login", { method: "POST", body: { password: $("pw").value } });
    token = data.token;
    try { localStorage.setItem(TOKEN_KEY, token); } catch {}
    $("pw").value = "";
    await showDash();
  } catch (err) {
    $("login-err").textContent = err.message;
  } finally { btn.disabled = false; }
});

// ---------- Dashboard ----------
async function showDash() {
  $("login-view").hidden = true; $("dash-view").hidden = false; $("logout").hidden = false;
  const data = await api("/api/projects");
  projects = data.projects;
  $("seed-banner").hidden = data.storage !== "seed";
  renderRows();
  resetForm();
}

const ICONS = {
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  del: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>',
};

function renderRows() {
  $("count").textContent = `(${projects.length})`;
  if (!projects.length) {
    $("rows").innerHTML = '<li class="empty-rows">No projects yet. Add your first one →</li>';
    return;
  }
  $("rows").innerHTML = projects.map((p, i) => `
    <li class="row ${p.id === editingId ? "editing" : ""}" data-id="${esc(p.id)}">
      ${frameHTML(p)}
      <div class="row-main">
        <div class="row-title">
          <b>${esc(p.name)}</b>
          <span class="badge badge-${esc(p.pricing)}">${esc(pricingLabel(p))}</span>
          ${p.featured ? '<span class="mono" style="color:var(--accent)">★</span>' : ""}
        </div>
        <a class="row-url mono" href="${esc(p.url)}" target="_blank" rel="noopener">${esc(hostOf(p.url))}</a>
      </div>
      <div class="row-actions">
        <button class="icon-btn" data-act="up" title="Move up" aria-label="Move ${esc(p.name)} up" ${i === 0 ? "disabled" : ""}>${ICONS.up}</button>
        <button class="icon-btn" data-act="down" title="Move down" aria-label="Move ${esc(p.name)} down" ${i === projects.length - 1 ? "disabled" : ""}>${ICONS.down}</button>
        <button class="icon-btn" data-act="edit" title="Edit" aria-label="Edit ${esc(p.name)}">${ICONS.edit}</button>
        <button class="icon-btn del" data-act="del" title="Delete" aria-label="Delete ${esc(p.name)}">${ICONS.del}</button>
      </div>
    </li>`).join("");
  $("rows").querySelectorAll(".row").forEach((el) => {
    loadThumb(el.querySelector(".shot"), projects.find((p) => p.id === el.dataset.id));
  });
}

$("rows").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const id = btn.closest(".row").dataset.id;
  const idx = projects.findIndex((p) => p.id === id);
  const p = projects[idx];
  const act = btn.dataset.act;

  if (act === "edit") return startEdit(p);

  if (act === "del") {
    if (!confirm(`Delete "${p.name}"? This can't be undone.`)) return;
    try {
      await api(`/api/projects?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      projects.splice(idx, 1);
      if (editingId === id) resetForm();
      renderRows(); toast(`Deleted ${p.name}`);
    } catch (err) { toast(err.message, true); }
    return;
  }

  if (act === "up" || act === "down") {
    const j = act === "up" ? idx - 1 : idx + 1;
    if (j < 0 || j >= projects.length) return;
    const before = projects.slice();
    [projects[idx], projects[j]] = [projects[j], projects[idx]];
    renderRows();
    try {
      await api("/api/projects?reorder=1", { method: "PUT", body: { ids: projects.map((x) => x.id) } });
    } catch (err) { projects = before; renderRows(); toast(err.message, true); }
  }
});

// ---------- Form ----------
$("preview-frame").innerHTML = frameHTML({ name: "preview", url: "" });
const previewShot = () => $("preview-frame").querySelector(".shot");

function setPricing(v) {
  pricing = v;
  $("f-pricing").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === v)));
  $("price-field").hidden = v === "free";
  updatePreviewMeta();
}
$("f-pricing").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) setPricing(b.dataset.v); });

function formData() {
  return {
    url: $("f-url").value.trim(),
    name: $("f-name").value.trim(),
    description: $("f-desc").value.trim(),
    pricing,
    price: $("f-price").value.trim(),
    tags: $("f-tags").value.split(",").map((t) => t.trim()).filter(Boolean),
    thumbnail: $("f-thumb").value.trim(),
    featured: $("f-featured").checked,
  };
}

function normUrl(u) {
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  try { return new URL(u).toString(); } catch { return ""; }
}

function updatePreviewMeta() {
  const d = formData();
  $("pv-name").textContent = d.name || "Project name";
  const b = $("pv-badge");
  b.className = `badge badge-${d.pricing}`;
  b.textContent = pricingLabel(d);
  $("preview-frame").querySelector(".frame-url").textContent = hostOf(normUrl(d.url)) || "your-site.com";
}

let lastShotKey = "";
function updatePreviewShot(force = false) {
  const d = formData();
  const url = normUrl(d.url);
  const thumb = normUrl(d.thumbnail);
  const key = url + "|" + thumb;
  if (!force && key === lastShotKey) return;
  lastShotKey = key;
  const shot = previewShot();
  if (!url && !thumb) {
    shot.querySelector("img").removeAttribute("src");
    shot.querySelector("img").classList.remove("ready");
    shot.querySelector(".shot-fallback")?.remove();
    shot.querySelector(".shot-loading").style.display = "";
    shot.querySelector(".shot-loading").textContent = "enter a URL to preview";
    return;
  }
  shot.querySelector(".shot-loading").textContent = "taking screenshot…";
  loadThumb(shot, { name: d.name || hostOf(url), url, thumbnail: thumb }, { bust: force ? Date.now().toString(36) : "" });
}

let shotTimer;
["f-url", "f-thumb"].forEach((id) =>
  $(id).addEventListener("input", () => { updatePreviewMeta(); clearTimeout(shotTimer); shotTimer = setTimeout(updatePreviewShot, 700); })
);
["f-name", "f-price"].forEach((id) => $(id).addEventListener("input", updatePreviewMeta));
$("refresh-shot").onclick = () => updatePreviewShot(true);

$("autofill").onclick = async () => {
  const url = normUrl($("f-url").value.trim());
  if (!url) return toast("Enter the website URL first.", true);
  const btn = $("autofill"); btn.disabled = true; btn.textContent = "Reading…";
  try {
    const m = await api(`/api/meta?url=${encodeURIComponent(url)}`);
    if (m.name && !$("f-name").value) $("f-name").value = m.name;
    if (m.description && !$("f-desc").value) $("f-desc").value = m.description;
    updatePreviewMeta(); updatePreviewShot();
    toast(m.name || m.description ? "Filled in from the website" : "Couldn't find details on that page");
  } catch (err) { toast(err.message, true); }
  finally { btn.disabled = false; btn.textContent = "Auto-fill"; }
};

function startEdit(p) {
  editingId = p.id;
  $("form-title").textContent = `Edit · ${p.name}`;
  $("save").textContent = "Save changes";
  $("cancel").hidden = false;
  $("f-url").value = p.url;
  $("f-name").value = p.name;
  $("f-desc").value = p.description || "";
  $("f-price").value = p.price || "";
  $("f-tags").value = (p.tags || []).join(", ");
  $("f-thumb").value = p.thumbnail || "";
  $("f-featured").checked = !!p.featured;
  setPricing(p.pricing || "free");
  updatePreviewShot(); renderRows();
  if (matchMedia("(max-width: 959px)").matches) $("editor").scrollIntoView({ behavior: "smooth" });
  $("f-name").focus({ preventScroll: true });
}

function resetForm() {
  editingId = null;
  $("form").reset();
  $("form-title").textContent = "Add project";
  $("save").textContent = "Add project";
  $("cancel").hidden = true;
  setPricing("free");
  lastShotKey = "x";
  updatePreviewShot();
  renderRows();
}
$("cancel").onclick = resetForm;
$("new-btn").onclick = () => { resetForm(); $("editor").scrollIntoView({ behavior: "smooth", block: "start" }); $("f-url").focus(); };

$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const d = formData();
  if (!normUrl(d.url)) return toast("Please enter a valid website URL.", true);
  if (!d.name) return toast("Please give the project a name.", true);
  const btn = $("save"); btn.disabled = true;
  try {
    if (editingId) {
      const { project } = await api(`/api/projects?id=${encodeURIComponent(editingId)}`, { method: "PUT", body: d });
      projects = projects.map((p) => (p.id === editingId ? project : p));
      toast(`Saved ${project.name}`);
    } else {
      const { project } = await api("/api/projects", { method: "POST", body: d });
      projects.unshift(project);
      toast(`Added ${project.name} — it's live on the site`);
    }
    resetForm();
  } catch (err) { toast(err.message, true); }
  finally { btn.disabled = false; }
});

// ---------- Boot ----------
if (token) showDash().catch(() => showLogin());
else showLogin();
