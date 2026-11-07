// POST /api/login  { password }  →  { token }
import { checkPassword, issueToken, send, readBody, handleError, storageMode } from "./_lib.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
    if (!process.env.ADMIN_PASSWORD)
      return send(res, 500, { error: "Set ADMIN_PASSWORD in your Vercel environment variables first." });

    const { password } = await readBody(req);
    // Small delay slows down password guessing.
    await new Promise((r) => setTimeout(r, 400));
    if (!checkPassword(password)) return send(res, 401, { error: "Wrong password." });

    return send(res, 200, { token: issueToken(), storage: storageMode() });
  } catch (e) {
    return handleError(res, e);
  }
}
