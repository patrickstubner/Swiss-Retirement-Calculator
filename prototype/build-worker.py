#!/usr/bin/env python3
"""Erzeugt worker.mjs (Dateien eingebettet) und optional ein Deploy-Skript für Cloudflare."""
import base64
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TEXT = {
    "/index.html": ("text/html; charset=utf-8", "index.html"),
    "/styles.css": ("text/css; charset=utf-8", "styles.css"),
    "/app.js": ("text/javascript; charset=utf-8", "app.js"),
}
BINARY = {
    "/icon-192.png": ("image/png", "icon-192.png"),
    "/apple-touch-icon.png": ("image/png", "apple-touch-icon.png"),
}

files = {}
for path, (mime, name) in TEXT.items():
    files[path] = {"t": mime, "b": (ROOT / name).read_text(encoding="utf-8")}
for path, (mime, name) in BINARY.items():
    files[path] = {"t": mime, "b64": base64.b64encode((ROOT / name).read_bytes()).decode("ascii")}

csp = (
    "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; "
    "font-src 'none'; connect-src 'none'; media-src 'none'; object-src 'none'; "
    "frame-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
)
tpl = (ROOT / "worker.tpl.mjs").read_text(encoding="utf-8")
worker = tpl.replace("__FILES__", json.dumps(files, ensure_ascii=False)).replace("__CSP__", json.dumps(csp))
(ROOT / "worker.mjs").write_text(worker, encoding="utf-8")

code = """async () => {
  const code = %s;
  const metadata = { main_module: "worker.js", compatibility_date: "2025-09-01" };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("worker.js", new Blob([code], { type: "application/javascript+module" }), "worker.js");
  const up = await cloudflare.request({
    method: "PUT",
    path: `/accounts/${accountId}/workers/scripts/ruhestandsrechner-prototyp`,
    body: form,
  });
  const sub = await cloudflare.request({
    method: "POST",
    path: `/accounts/${accountId}/workers/scripts/ruhestandsrechner-prototyp/subdomain`,
    body: { enabled: true, previews_enabled: false },
  });
  return { uploaded: up.success, subdomain: sub.result || sub };
}
""" % json.dumps(worker, ensure_ascii=False)
Path("/tmp/rr-deploy-code.tmp.js").write_text(code, encoding="utf-8")
print("wrote", ROOT / "worker.mjs", "bytes", (ROOT / "worker.mjs").stat().st_size)
print("wrote /tmp/rr-deploy-code.tmp.js", Path("/tmp/rr-deploy-code.tmp.js").stat().st_size)
