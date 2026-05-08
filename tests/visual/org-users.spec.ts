import { test } from '@playwright/test'
import percySnapshot from '@percy/playwright'

// Optional environment overrides for targeting a specific booking/inquiry
const BOOKING_ID = process.env.VISUAL_BOOKING_ID
const INQUIRY_ID = process.env.VISUAL_INQUIRY_ID

// SAME_NAME=1 makes Owner and Member snapshots share the same names ("Dashboard", "Messages")
// ROLE can be 'owner' or 'member' to run only that block
const SAME_NAME = process.env.SAME_NAME === '1' || process.env.SAME_NAME === 'true'
const ROLE = (process.env.ROLE || '').toLowerCase() // '', 'owner', 'member'

const nameFor = (roleLabel: 'Owner' | 'Member', base: string) =>
  SAME_NAME ? base : `${roleLabel}  ${base}`.replace('\u0013', '–')

async function openBookingIfProvided(page) {
  if (BOOKING_ID) {
    // Add booking param to URL to open BookingDetails drawer in Dashboard
    await page.goto(`/dashboard?booking=${BOOKING_ID}`)
    await page.waitForLoadState('networkidle')
    // Wait for the drawer header to appear if possible
    await page.waitForTimeout(500)
    return
  }
  // Fallback: just visit dashboard and wait for main heading
  await page.goto('/dashboard')
  await page.waitForLoadState('networkidle')
}

async function openInquiryIfProvided(page) {
  if (INQUIRY_ID) {
    await page.goto(`/messages?inquiry=${INQUIRY_ID}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)
    return
  }
  await page.goto('/messages')
  await page.waitForLoadState('networkidle')
}

// OWNER BLOCK (conditioned by ROLE)
if (!ROLE || ROLE === 'owner') {
  test.describe('Owner visual snapshots', () => {
    test.use({ storageState: '.auth/owner.json' })

    test('Dashboard (Owner)', async ({ page }) => {
      await openBookingIfProvided(page)
      await percySnapshot(page, nameFor('Owner', 'Dashboard'))
    })

    test('Messages (Owner)', async ({ page }) => {
      await openInquiryIfProvided(page)
      await percySnapshot(page, nameFor('Owner', 'Messages'))
    })
  })
}

// ORG MEMBER BLOCK (conditioned by ROLE)
if (!ROLE || ROLE === 'member') {
  test.describe('Org Member visual snapshots', () => {
    test.use({ storageState: '.auth/member.json' })

    test('Dashboard (Member)', async ({ page }) => {
      await openBookingIfProvided(page)
      await percySnapshot(page, nameFor('Member', 'Dashboard'))
    })

    test('Messages (Member)', async ({ page }) => {
      await openInquiryIfProvided(page)
      await percySnapshot(page, nameFor('Member', 'Messages'))
    })
  })
}
