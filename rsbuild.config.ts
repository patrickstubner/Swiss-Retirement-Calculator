import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

/**
 * GitHub Pages (Projektseite): https://patrickstubner.github.io/Swiss-Retirement-Calculator/ (Repo: github.com/patrickstubner/Swiss-Retirement-Calculator)
 * `server.base` setzt den Basis-Pfad für Dev-Server, Preview und (über den Default von
 * `output.assetPrefix`) für die Asset-URLs im Build.
 */
export default defineConfig({
  plugins: [pluginReact()],
  source: {
    entry: { index: './src/index.tsx' },
  },
  server: {
    base: '/Swiss-Retirement-Calculator/',
  },
  html: {
    title: 'Ruhestandsrechner Schweiz',
    template: './src/index.html',
    favicon: './public/favicon.svg',
  },
  output: {
    distPath: { root: 'dist' },
  },
  performance: {
    chunkSplit: { strategy: 'split-by-experience' },
  },
});
