// PDD Trainer — sync backend (Cloudflare Worker + KV)
// GET  /<code>  -> returns stored JSON blob (or {} if none)
// PUT  /<code>  -> stores JSON blob (max ~256KB)
// The <code> is an unguessable sync code that acts as the secret key.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function json(obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...CORS, ...extra },
  });
}

function validCode(code) {
  return typeof code === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(code);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    const code = decodeURIComponent(url.pathname.replace(/^\/+/, "").split("/")[0]);

    if (!code) return json({ ok: true, service: "pdd-sync" });
    if (!validCode(code)) return json({ error: "bad code" }, 400);

    const key = "p:" + code;

    if (request.method === "GET") {
      const data = await env.SYNC.get(key);
      return json({ ok: true, data: data ? JSON.parse(data) : null });
    }

    if (request.method === "PUT") {
      const body = await request.text();
      if (body.length > 262144) return json({ error: "too large" }, 413);
      let parsed;
      try { parsed = JSON.parse(body); } catch (e) { return json({ error: "bad json" }, 400); }
      await env.SYNC.put(key, JSON.stringify(parsed));
      return json({ ok: true, savedAt: Date.now() });
    }

    return json({ error: "method not allowed" }, 405);
  },
};
