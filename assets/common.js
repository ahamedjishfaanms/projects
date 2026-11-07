// Shared helpers: live website screenshots, theme toggle, small utilities.

// ---------- Thumbnails ----------
// 1st choice: custom image set in admin.
// 2nd: WordPress mShots (free, no API key). It returns a 400×300 "generating"
//      placeholder for new URLs, so we retry a few times until the real shot is ready.
// 3rd: thum.io (free tier).  4th: a styled card with the project's initial.
const MSHOTS = (url, bust) =>
  `https://s0.wp.com/mshots/v1/${encodeURIComponent(url)}?w=1280&h=800${bust ? `&r=${bust}` : ""}`;
const THUMIO = (url) => `https://image.thum.io/get/width/1280/crop/800/noanimate/${url}`;

export function hostOf(url) {
  try { return new URL(url).host.replace(/^www\./, ""); } catch { return url; }
}

export function frameHTML(p) {
  return `
    <div class="frame">
      <div class="frame-bar" aria-hidden="true"><i></i><i></i><i></i>
        <span class="frame-url">${esc(hostOf(p.url))}</span></div>
      <div class="shot">
        <div class="shot-loading mono">loading preview…</div>
        <img alt="Screenshot of ${esc(p.name)}" loading="lazy" decoding="async" />
      </div>
    </div>`;
}

// Fill a .shot element with the best available image for project p.
export function loadThumb(shotEl, p, { bust = "" } = {}) {
  const img = shotEl.querySelector("img");
  const loading = shotEl.querySelector(".shot-loading");
  shotEl.querySelector(".shot-fallback")?.remove();
  img.classList.remove("ready");
  if (loading) loading.style.display = "";

  const sources = [];
  if (p.thumbnail) sources.push({ src: p.thumbnail });
  if (p.url) {
    sources.push({ src: MSHOTS(p.url, bust), mshots: true });
    sources.push({ src: THUMIO(p.url) });
  }

  let i = 0, retries = 0;
  const token = Symbol();
  shotEl._token = token;

  const fail = () => {
    if (shotEl._token !== token) return;
    if (loading) loading.style.display = "none";
    const fb = document.createElement("div");
    fb.className = "shot-fallback";
    fb.innerHTML = `<div><b>${esc((p.name || "?").slice(0, 1).toUpperCase())}</b><span>${esc(hostOf(p.url || ""))}</span></div>`;
    shotEl.appendChild(fb);
  };

  const tryNext = () => {
    if (shotEl._token !== token) return;
    const s = sources[i];
    if (!s) return fail();
    img.onload = () => {
      if (shotEl._token !== token) return;
      // mShots placeholder is exactly 400×300 — wait and retry.
      if (s.mshots && img.naturalWidth === 400 && img.naturalHeight === 300) {
        if (retries++ < 6) {
          return setTimeout(() => { img.src = MSHOTS(p.url, `${bust}${retries}`); }, 2500);
        }
        i++; return tryNext();
      }
      img.classList.add("ready");
      if (loading) loading.style.display = "none";
    };
    img.onerror = () => { i++; tryNext(); };
    img.src = s.src;
  };
  tryNext();
}

// ---------- Theme ----------
export function initTheme(btn) {
  const root = document.documentElement;
  let saved = null;
  try { saved = localStorage.getItem("bt-theme"); } catch {}
  if (saved) root.dataset.theme = saved;
  const isDark = () =>
    root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  const paint = () => {
    btn.innerHTML = isDark()
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
    btn.setAttribute("aria-label", isDark() ? "Switch to light mode" : "Switch to dark mode");
  };
  btn.addEventListener("click", () => {
    root.dataset.theme = isDark() ? "light" : "dark";
    try { localStorage.setItem("bt-theme", root.dataset.theme); } catch {}
    paint();
  });
  paint();
}

// ---------- Utils ----------
export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function pricingLabel(p) {
  const base = { free: "Free", paid: "Paid", freemium: "Freemium" }[p.pricing] || "Free";
  return p.price && p.pricing !== "free" ? `${base} · ${p.price}` : base;
}

export function toast(msg, isError = false) {
  let el = document.querySelector(".toast");
  if (!el) { el = document.createElement("div"); el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.toggle("error", isError);
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 2800);
}
