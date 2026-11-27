# Redesign prototype

Clickable UX proposal for a future redesign of the Swiss Retirement Calculator. It lives in this folder of the `Swiss-Retirement-Calculator` repository. It is not a replacement for the production app, has no real calculation engine, and is not financial advice.

- Static HTML, CSS and JavaScript only. No build, no runtime dependencies, no network, no persistence.
- Starts with a **sample household** (year of birth 1976, canton of Zurich). First only headline figures; the rest are visible defaults. The result is a rough estimate and can be refined optionally, including property and relocation modules. The planning horizon stays 120.
- There is no "quick / detailed" switch.
- The folder is part of the repository so the prototype stays with the product. It is excluded from the app's lint, tests and production build. The production GitHub Pages app is unchanged.

## Preview

Served for free as a Cloudflare Worker (same approach as the Edovita prototype), without replacing the app's GitHub Pages:

- https://ruhestandsrechner-prototyp.pstubner.workers.dev/

Locally: run `python3 -m http.server` in this folder.

To rebuild the Worker bundle: `python3 build-worker.py` writes `worker.mjs` (gitignored). The script embeds the files in this folder into the Worker. Agents must not deploy the Worker (`wrangler deploy` and the deploy helper in the build script are out of scope).

## Security reviews

| Date | Stand | Source | Result |
|---|---|---|---|
| 22.11.2026 | First version in `prototype/` | independent review | no vulnerabilities. No secrets, no third-party scripts, no `localStorage`. CSP via meta tag. Inputs are numbers only; output uses `textContent`. |
| 24.11.2026 | Branch `prototype/redesign`, delivery as Cloudflare Worker `ruhestandsrechner-prototyp` | security-review skill after the code change | no vulnerabilities. The Worker embeds only the files in this folder (including logos as Base64), no network, no secrets, no cookies. In addition to the meta CSP, the Worker sets security headers (`Content-Security-Policy` including `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, HSTS). `worker.mjs` is not committed. |
