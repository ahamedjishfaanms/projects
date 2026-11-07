// GET /api/meta?url=https://...  (admin)
// Reads a site's <title>, meta description and og:image so the admin form can auto-fill.
import { isAuthed, send, handleError, normalizeUrl } from "./_lib.js";

function pick(html, re) {
  const m = html.match(re);
  return m ? decode(m[1].trim()) : "";
}

function decode(s) {
  return s
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#x27;/g, "'")
    .replace(/&mdash;|&#8212;/g, "—").replace(/&ndash;|&#8211;/g, "–");
}

function metaContent(html, attr, name) {
  const a = new RegExp(`<meta[^>]+${attr}=["']${name}["'][^>]*content=["']([^"']*)["']`, "i");
  const b = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*${attr}=["']${name}["']`, "i");
  return pick(html, a) || pick(html, b);
}

export default async function handler(req, res) {
  try {
    if (!isAuthed(req)) return send(res, 401, { error: "Please log in again." });
    const target = normalizeUrl(new URL(req.url, "http://x").searchParams.get("url"));
    if (!target) return send(res, 400, { error: "Invalid URL." });

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(target, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BeingtechyProjects/1.0)" },
    }).finally(() => clearTimeout(timer));

    const html = (await r.text()).slice(0, 300_000);
    const title =
      metaContent(html, "property", "og:title") ||
      metaContent(html, "name", "apple-mobile-web-app-title") ||
      pick(html, /<title[^>]*>([^<]*)<\/title>/i);
    const description =
      metaContent(html, "name", "description") || metaContent(html, "property", "og:description");
    let image = metaContent(html, "property", "og:image");
    if (image) image = new URL(image, target).toString();

    // "Hey Ticket — events, done properly" → name "Hey Ticket"
    const name = title.split(/\s[—–|·-]\s/)[0].trim();
    return send(res, 200, { name, title, description, image });
  } catch (e) {
    if (e.name === "AbortError") return send(res, 504, { error: "That site took too long to respond." });
    return handleError(res, e);
  }
}
