/**
 * Cloudflare Worker für den Redesign-Prototyp.
 * Dateien werden von build-worker.py eingebettet. Kein Netz, keine Secrets.
 */
const FILES = __FILES__;
const SEC = {
  "Content-Security-Policy": __CSP__,
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Strict-Transport-Security": "max-age=31536000",
  "Cache-Control": "no-cache",
};

function bodyOf(file) {
  if (file.b64) {
    const bin = atob(file.b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  return file.b;
}

export default {
  async fetch(request) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405, headers: { ...SEC, Allow: "GET, HEAD" } });
    }
    let path = new URL(request.url).pathname;
    if (path === "/" || path === "") path = "/index.html";
    if (!Object.prototype.hasOwnProperty.call(FILES, path)) {
      return new Response("Nicht gefunden", { status: 404, headers: { ...SEC, "Content-Type": "text/plain; charset=utf-8" } });
    }
    const f = FILES[path];
    const body = bodyOf(f);
    const headers = { ...SEC, "Content-Type": f.t };
    // HEAD ohne Körper, aber mit korrekter Länge (ein leeres null-Body hat zuvor 1042 ausgelöst).
    if (request.method === "HEAD") {
      const len = typeof body === "string" ? new TextEncoder().encode(body).length : body.byteLength;
      return new Response("", { status: 200, headers: { ...headers, "Content-Length": String(len) } });
    }
    return new Response(body, { status: 200, headers });
  },
};
