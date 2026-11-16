import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type RsbuildPlugin } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { precacheListe, swQuelltext } from './scripts/pwa-lib.mjs';

const version = (JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string })
  .version;

/** Homescreen-App: schreibt nach dem Produktions-Build dist/sw.js (versionierter Cache, siehe scripts/pwa-lib.mjs). */
const pwaPlugin: RsbuildPlugin = {
  name: 'ruhestandsrechner-pwa',
  setup(api) {
    api.onAfterBuild(({ isFirstCompile }) => {
      if (!isFirstCompile) return;
      const dist = api.context.distPath;
      writeFileSync(join(dist, 'sw.js'), swQuelltext(version, precacheListe(dist)));
    });
  },
};

/**
 * GitHub Pages (Projektseite): https://<konto>.github.io/Swiss-Retirement-Calculator/
 * `server.base` setzt den Basis-Pfad für Dev-Server, Preview und (über den Default von
 * `output.assetPrefix`) für die Asset-URLs im Build.
 */
export default defineConfig({
  plugins: [pluginReact(), pwaPlugin],
  source: {
    entry: { index: './src/index.tsx' },
  },
  server: {
    base: '/Swiss-Retirement-Calculator/',
  },
  html: {
    title: 'Ruhestandsrechner Schweiz',
    template: './src/index.html',
  },
  output: {
    distPath: { root: 'dist' },
  },
  performance: {
    chunkSplit: { strategy: 'split-by-experience' },
  },
});
