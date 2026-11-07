// GET    /api/projects            → public list
// POST   /api/projects            → create          (admin)
// PUT    /api/projects?id=xyz     → update          (admin)
// PUT    /api/projects?reorder=1  → body {ids:[...]} (admin)
// DELETE /api/projects?id=xyz     → delete          (admin)
import {
  loadProjects, saveProjects, isAuthed, send, readBody, handleError,
  cleanProject, slugify, storageMode,
} from "./_lib.js";

const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, "http://x");
    const id = url.searchParams.get("id");

    if (req.method === "GET") {
      const list = (await loadProjects()).sort(byOrder);
      res.setHeader("CDN-Cache-Control", "s-maxage=30, stale-while-revalidate=300");
      return send(res, 200, { projects: list, storage: storageMode() });
    }

    if (!isAuthed(req)) return send(res, 401, { error: "Please log in again." });
    const list = await loadProjects();

    if (req.method === "POST") {
      const body = await readBody(req);
      const project = cleanProject(body);
      let base = slugify(project.name), newId = base, n = 2;
      while (list.some((p) => p.id === newId)) newId = `${base}-${n++}`;
      project.id = newId;
      project.createdAt = new Date().toISOString();
      project.order = list.length ? Math.min(...list.map((p) => p.order ?? 0)) - 1 : 0; // newest on top
      project.tags ??= [];
      project.thumbnail ??= "";
      project.featured ??= false;
      project.price ??= "";
      project.description ??= "";
      list.push(project);
      await saveProjects(list);
      return send(res, 201, { project });
    }

    if (req.method === "PUT" && url.searchParams.get("reorder")) {
      const { ids = [] } = await readBody(req);
      ids.forEach((pid, i) => {
        const p = list.find((x) => x.id === pid);
        if (p) p.order = i;
      });
      await saveProjects(list);
      return send(res, 200, { projects: list.sort(byOrder) });
    }

    if (req.method === "PUT") {
      const idx = list.findIndex((p) => p.id === id);
      if (idx === -1) return send(res, 404, { error: "Project not found." });
      list[idx] = cleanProject(await readBody(req), list[idx]);
      await saveProjects(list);
      return send(res, 200, { project: list[idx] });
    }

    if (req.method === "DELETE") {
      const next = list.filter((p) => p.id !== id);
      if (next.length === list.length) return send(res, 404, { error: "Project not found." });
      await saveProjects(next);
      return send(res, 200, { ok: true });
    }

    res.setHeader("Allow", "GET, POST, PUT, DELETE");
    return send(res, 405, { error: "Method not allowed" });
  } catch (e) {
    return handleError(res, e);
  }
}
