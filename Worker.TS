import { Hono } from "hono";
import { z } from "zod";

const app = new Hono<{ Bindings: CloudflareBindings }>();

// ─────────────────────────────────────────────
//  JWT helpers (no external library — pure CF WebCrypto)
// ─────────────────────────────────────────────

async function signJwt(payload: object, secret: string): Promise<string> {
	const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
		.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
	const body = btoa(JSON.stringify(payload))
		.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
	const key = await crypto.subtle.importKey(
		"raw", new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" }, false, ["sign"]
	);
	const sig = await crypto.subtle.sign("HMAC", key,
		new TextEncoder().encode(`${header}.${body}`));
	const b64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
		.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
	return `${header}.${body}.${b64}`;
}

async function verifyJwt(token: string, secret: string): Promise<boolean> {
	try {
		const [header, body, sig] = token.split(".");
		const key = await crypto.subtle.importKey(
			"raw", new TextEncoder().encode(secret),
			{ name: "HMAC", hash: "SHA-256" }, false, ["verify"]
		);
		const sigBytes = Uint8Array.from(atob(sig.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
		const valid = await crypto.subtle.verify("HMAC", key,
			sigBytes, new TextEncoder().encode(`${header}.${body}`));
		if (!valid) return false;
		const { exp } = JSON.parse(atob(body.replace(/-/g, "+").replace(/_/g, "/")));
		return !exp || Date.now() / 1000 < exp;
	} catch {
		return false;
	}
}

function authError(): Response {
	return new Response(JSON.stringify({ error: "Unauthorized" }), {
		status: 401, headers: { "Content-Type": "application/json" }
	});
}

// Middleware: require valid JWT for protected routes
async function requireAuth(c: any, next: any) {
	const auth = c.req.header("Authorization") ?? "";
	const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
	if (!token || !(await verifyJwt(token, c.env.JWT_SECRET))) {
		return authError();
	}
	await next();
}

// ─────────────────────────────────────────────
//  Auth routes
// ─────────────────────────────────────────────

// POST /api/auth/login  { username, password }
app.post("/api/auth/login", async (c) => {
	const body = await c.req.json().catch(() => ({}));
	const { username, password } = body as { username?: string; password?: string };

	if (!username || !password) {
		return c.json({ error: "Missing credentials" }, 400);
	}

	// Timing-safe comparison using SubtleCrypto
	const enc = new TextEncoder();
	const usernameMatch = crypto.subtle.timingSafeEqual(
		enc.encode(username.padEnd(64)),
		enc.encode((c.env.USERNAME ?? "").padEnd(64))
	);
	const passwordMatch = crypto.subtle.timingSafeEqual(
		enc.encode(password.padEnd(64)),
		enc.encode((c.env.PASSWORD ?? "").padEnd(64))
	);

	if (!usernameMatch || !passwordMatch) {
		return c.json({ error: "Invalid credentials" }, 401);
	}

	const token = await signJwt({
		sub: username,
		iss: c.env.JWT_ISSUER ?? "wz-drop",
		iat: Math.floor(Date.now() / 1000),
		exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
	}, c.env.JWT_SECRET);

	return c.json({ token });
});

// ─────────────────────────────────────────────
//  Drop routes  (all require auth)
// ─────────────────────────────────────────────

// POST /api/drop/text   { title, content, note }
app.post("/api/drop/text", requireAuth, async (c) => {
	const schema = z.object({
		title: z.string().max(256).optional(),
		content: z.string().max(500_000),
		note: z.string().max(512).optional(),
	});
	const body = schema.safeParse(await c.req.json().catch(() => ({})));
	if (!body.success) return c.json({ error: "Invalid body" }, 400);

	const id = crypto.randomUUID();
	const meta = {
		id, type: "text",
		name: body.data.title || "Untitled Clip",
		size: `${body.data.content.length} chars`,
		note: body.data.note ?? "",
		timestamp: new Date().toISOString(),
	};

	await c.env.KV.put(`drop:text:${id}`, body.data.content, {
		metadata: meta,
		expirationTtl: 60 * 60 * 24 * 30, // 30 days
	});

	return c.json({ ok: true, item: meta });
});

// POST /api/drop/url   { url, label, note }
app.post("/api/drop/url", requireAuth, async (c) => {
	const schema = z.object({
		url: z.string().url().max(4096),
		label: z.string().max(256).optional(),
		note: z.string().max(512).optional(),
	});
	const body = schema.safeParse(await c.req.json().catch(() => ({})));
	if (!body.success) return c.json({ error: "Invalid body" }, 400);

	const id = crypto.randomUUID();
	const meta = {
		id, type: "url",
		name: body.data.label || body.data.url,
		size: "—",
		note: body.data.note ?? "",
		timestamp: new Date().toISOString(),
		url: body.data.url,
	};

	await c.env.KV.put(`drop:url:${id}`, body.data.url, {
		metadata: meta,
		expirationTtl: 60 * 60 * 24 * 30,
	});

	return c.json({ ok: true, item: meta });
});

// POST /api/drop/file   multipart/form-data { file, note }
app.post("/api/drop/file", requireAuth, async (c) => {
	const formData = await c.req.formData().catch(() => null);
	if (!formData) return c.json({ error: "Expected multipart form" }, 400);

	const file = formData.get("file") as File | null;
	const note = (formData.get("note") as string | null) ?? "";

	if (!file) return c.json({ error: "No file provided" }, 400);

	// 100 MB limit
	if (file.size > 100 * 1024 * 1024) {
		return c.json({ error: "File too large (max 100 MB)" }, 413);
	}

	const id = crypto.randomUUID();
	const ext = file.name.split(".").pop() ?? "";
	const r2Key = `drop/${id}${ext ? "." + ext : ""}`;

	await c.env.R2.put(r2Key, file.stream(), {
		httpMetadata: { contentType: file.type || "application/octet-stream" },
		customMetadata: { originalName: file.name, note },
	});

	const meta = {
		id, type: "file",
		name: file.name,
		size: formatBytes(file.size),
		note,
		timestamp: new Date().toISOString(),
		r2Key,
		mime: file.type,
	};

	await c.env.KV.put(`drop:file:${id}`, r2Key, {
		metadata: meta,
		expirationTtl: 60 * 60 * 24 * 30,
	});

	return c.json({ ok: true, item: meta });
});

// GET /api/drop/list   — returns all drop items (metadata only)
app.get("/api/drop/list", requireAuth, async (c) => {
	const [texts, urls, files] = await Promise.all([
		c.env.KV.list({ prefix: "drop:text:" }),
		c.env.KV.list({ prefix: "drop:url:" }),
		c.env.KV.list({ prefix: "drop:file:" }),
	]);

	const items = [
		...texts.keys.map(k => k.metadata),
		...urls.keys.map(k => k.metadata),
		...files.keys.map(k => k.metadata),
	].filter(Boolean).sort((a: any, b: any) =>
		new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
	);

	return c.json({ items });
});

// GET /api/drop/item/:id   — get text/url content
app.get("/api/drop/item/:id", requireAuth, async (c) => {
	const id = c.req.param("id");

	// try text then url
	for (const prefix of ["drop:text:", "drop:url:"]) {
		const val = await c.env.KV.getWithMetadata(prefix + id);
		if (val.value !== null) {
			return c.json({ value: val.value, metadata: val.metadata });
		}
	}

	// file: look up r2Key from KV, stream from R2
	const fileMeta = await c.env.KV.getWithMetadata<{ r2Key: string; mime: string; name: string }>(`drop:file:${id}`);
	if (fileMeta.value) {
		const obj = await c.env.R2.get(fileMeta.value);
		if (obj) {
			return new Response(obj.body, {
				headers: {
					"Content-Type": fileMeta.metadata?.mime || "application/octet-stream",
					"Content-Disposition": `inline; filename="${fileMeta.metadata?.name ?? "file"}"`,
				},
			});
		}
	}

	return c.json({ error: "Not found" }, 404);
});

// DELETE /api/drop/item/:id
app.delete("/api/drop/item/:id", requireAuth, async (c) => {
	const id = c.req.param("id");

	for (const prefix of ["drop:text:", "drop:url:"]) {
		const val = await c.env.KV.get(prefix + id);
		if (val !== null) {
			await c.env.KV.delete(prefix + id);
			return c.json({ ok: true });
		}
	}

	const fileMeta = await c.env.KV.getWithMetadata<{ r2Key: string }>(`drop:file:${id}`);
	if (fileMeta.value) {
		await Promise.all([
			c.env.R2.delete(fileMeta.value),
			c.env.KV.delete(`drop:file:${id}`),
		]);
		return c.json({ ok: true });
	}

	return c.json({ error: "Not found" }, 404);
});

// ─────────────────────────────────────────────
//  Static assets fallback
// ─────────────────────────────────────────────
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────
function formatBytes(bytes: number): string {
	if (bytes < 1024) return bytes + " B";
	if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
	return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default app;