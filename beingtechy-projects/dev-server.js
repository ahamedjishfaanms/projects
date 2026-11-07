// Local preview server — run `npm run dev` then open http://localhost:3000
// Mimics Vercel: serves static files and routes /api/* to the functions in /api.
// Data is saved to .local-data.json. Admin password defaults to "admin" locally.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
process.env.ADMIN_PASSWORD ||= "admin";
process.env.LOCAL_DATA_FILE ||= path.join(root, ".local-data.json");

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript",
  ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".json": "application/json",
};

http
  .createServer(async (req, res) => {
    const { pathname } = new URL(req.url, "http://localhost");
    try {
      if (pathname.startsWith("/api/")) {
        const name = pathname.slice(5).replace(/[^a-z0-9-]/gi, "");
        const mod = await import(pathToFileURL(path.join(root, "api", name + ".js")).href);
        return await mod.default(req, res);
      }
      let file = pathname === "/" ? "/index.html" : pathname;
      if (pathname === "/admin") file = "/admin.html";
      const full = path.join(root, path.normalize(file));
      if (!full.startsWith(root)) throw new Error("bad path");
      const data = await fs.readFile(full);
      res.writeHead(200, { "Content-Type": TYPES[path.extname(full)] || "application/octet-stream" });
      res.end(data);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
    }
  })
  .listen(3000, () => console.log("→ http://localhost:3000   (admin: /admin, password: admin)"));
