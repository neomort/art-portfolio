import { defineConfig } from '@playwright/test';
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Lightweight env loader: reads .env.local first, then .env if present.
// Does not overwrite existing process.env keys.
function loadEnvFile(filePath: string) {
  try {
    if (!fs.existsSync(filePath)) return
    const content = fs.readFileSync(filePath, 'utf8')
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const eq = line.indexOf('=')
      if (eq === -1) continue
      const key = line.slice(0, eq).trim()
      let value = line.slice(eq + 1).trim()
      // Remove surrounding quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
        value = value.slice(1, -1)
      }
      if (!(key in process.env)) {
        process.env[key] = value
      }
    }
  } catch {
    // Ignore parse errors silently to avoid breaking tests
  }
}

const __filename = fileURLToPath(import.meta.url)
const __dirname_esm = path.dirname(__filename)
const projectRoot = path.resolve(__dirname_esm, '..')
// Try project root .env.local and .env
loadEnvFile(path.join(projectRoot, '.env.local'))
loadEnvFile(path.join(projectRoot, '.env'))

// API-only Playwright config: no browser projects, no webServer.
export default defineConfig({
  // This config file is located under the `tests/` folder,
  // so point testDir to the current directory.
  testDir: '.',
  reporter: 'list',
  // We keep defaults for timeouts; API tests are lightweight.
  timeout: 30 * 1000,
  expect: { timeout: 5000 },
  // Include a minimal project so Playwright actually runs tests.
  projects: [
    {
      name: 'api',
      use: {}, // no browser context needed
    },
  ],
});
