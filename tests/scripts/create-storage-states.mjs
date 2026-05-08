import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

// Usage:
//   OWNER_EMAIL=... OWNER_PASSWORD=... MEMBER_EMAIL=... MEMBER_PASSWORD=... node tests/scripts/create-storage-states.mjs
// Optionally set BASE_URL (defaults to http://localhost:5173)
// Storage states will be written to .auth/owner.json and .auth/member.json

const BASE_URL = process.env.BASE_URL || process.env.PW_BASE_URL || 'http://localhost:5173'

async function ensureDir(p) {
  await fs.promises.mkdir(p, { recursive: true }).catch(() => {})
}

async function createState({ email, password, outPath }) {
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()
  try {
    await page.goto(`${BASE_URL}/signin`, { waitUntil: 'domcontentloaded' })
    // Wait for either explicit label or the inputs themselves
    const emailLocator = page.locator('input[type="email"], input[name="email"]')
    const passwordLocator = page.locator('input[type="password"], input[name="password"]')
    await emailLocator.waitFor({ timeout: 30000 })
    await passwordLocator.waitFor({ timeout: 30000 })

    await emailLocator.fill(email)
    await passwordLocator.fill(password)

    // Click the actual form submit button (not OAuth buttons)
    const signInButton = page.locator('button[type="submit"]')
    await Promise.all([
      // Consider login successful when we leave /signin
      page.waitForURL((url) => {
        try {
          const u = new URL(url)
          return !u.pathname.includes('/signin')
        } catch { return false }
      }, { timeout: 30000 }).catch(() => {}),
      signInButton.click(),
    ])
    // Small settle delay for session storage
    await page.waitForTimeout(1000)
    await ensureDir(path.dirname(outPath))
    await context.storageState({ path: outPath })
    console.log(`Saved storage state: ${outPath}`)
  } finally {
    await browser.close()
  }
}

async function main() {
  const ownerEmail = process.env.OWNER_EMAIL
  const ownerPassword = process.env.OWNER_PASSWORD
  const memberEmail = process.env.MEMBER_EMAIL
  const memberPassword = process.env.MEMBER_PASSWORD

  if (!ownerEmail || !ownerPassword || !memberEmail || !memberPassword) {
    console.error('Missing credentials. Set OWNER_EMAIL, OWNER_PASSWORD, MEMBER_EMAIL, MEMBER_PASSWORD environment variables.')
    process.exit(1)
  }

  await createState({ email: ownerEmail, password: ownerPassword, outPath: '.auth/owner.json' })
  await createState({ email: memberEmail, password: memberPassword, outPath: '.auth/member.json' })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
