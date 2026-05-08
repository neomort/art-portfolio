#!/usr/bin/env node
/*
  Migrate users between Supabase projects using Admin API (service_role keys).

  What it does:
  - Paginates through SOURCE users via supabase.auth.admin.listUsers
  - Creates users in TARGET via supabase.auth.admin.createUser
  - Marks emails as confirmed (email_confirm: true)
  - Optionally sends password reset emails in the target project

  Env vars (see .env.migrate.example):
  - SOURCE_SUPABASE_URL
  - SOURCE_SERVICE_ROLE
  - TARGET_SUPABASE_URL
  - TARGET_SERVICE_ROLE
  - PAGE_SIZE (optional, default 200)
  - DRY_RUN (optional, '1' to not write changes)
  - SEND_PASSWORD_RESET (optional, '1' to send reset emails in target)

  Usage:
    node scripts/migrate-users.mjs
*/
import { config } from 'dotenv'
import { existsSync } from 'fs'
// Prefer .env.migrate for explicit migration creds; fall back to .env
const envFile = existsSync('.env.migrate') ? '.env.migrate' : '.env'
config({ path: envFile })
import { createClient } from '@supabase/supabase-js'

function reqEnv(name) {
  const v = process.env[name]
  if (!v) {
    console.error(`Missing required env: ${name}`)
    process.exit(1)
  }
  return v
}

const SOURCE_SUPABASE_URL = reqEnv('SOURCE_SUPABASE_URL')
const SOURCE_SERVICE_ROLE = reqEnv('SOURCE_SERVICE_ROLE')
const TARGET_SUPABASE_URL = reqEnv('TARGET_SUPABASE_URL')
const TARGET_SERVICE_ROLE = reqEnv('TARGET_SERVICE_ROLE')

const PAGE_SIZE = parseInt(process.env.PAGE_SIZE || '200', 10)
const DRY_RUN = process.env.DRY_RUN === '1'
const SEND_PASSWORD_RESET = process.env.SEND_PASSWORD_RESET === '1'
const SET_TEMP_PASSWORD = process.env.SET_TEMP_PASSWORD === '1'
const TEMP_PASSWORD = process.env.TEMP_PASSWORD || 'TempPass!1234'
const CHECK_PROFILE_CONFLICTS = process.env.CHECK_PROFILE_CONFLICTS === '1'
const PROFILE_CONFLICT_DELETE = process.env.PROFILE_CONFLICT_DELETE === '1'

const source = createClient(SOURCE_SUPABASE_URL, SOURCE_SERVICE_ROLE, { auth: { persistSession: false } })
const target = createClient(TARGET_SUPABASE_URL, TARGET_SERVICE_ROLE, { auth: { persistSession: false } })

async function resolveProfileConflict(email) {
  try {
    const { data: rows, error } = await target.from('profiles').select('id, email').eq('email', email).limit(1)
    if (error) {
      console.warn(`Profile lookup failed for ${email}: ${error.message}`)
      return false
    }
    if (!rows || rows.length === 0) return false
    console.warn(`Found conflicting profile row for ${email}.`)
    if (PROFILE_CONFLICT_DELETE) {
      if (DRY_RUN) {
        console.warn(`[DRY_RUN] Would delete conflicting profile for ${email}`)
        return true
      }
      const { error: delErr } = await target.from('profiles').delete().eq('email', email)
      if (delErr) {
        console.warn(`Failed to delete conflicting profile for ${email}: ${delErr.message}`)
        return false
      }
      console.log(`Deleted conflicting profile for ${email}`)
      return true
    } else {
      console.warn(`PROFILE_CONFLICT_DELETE not set; leaving row in place.`)
    }
  } catch (e) {
    console.warn(`resolveProfileConflict threw for ${email}: ${e?.message || e}`)
  }
  return false
}

async function migrate() {
  console.log(`Starting user migration`)
  console.log(`Using env file: ${envFile}`)
  console.log(`Source: ${SOURCE_SUPABASE_URL}`)
  console.log(`Target: ${TARGET_SUPABASE_URL}`)
  console.log(`Page size: ${PAGE_SIZE}, Dry run: ${DRY_RUN}, Send password reset: ${SEND_PASSWORD_RESET}`)

  let page = 1
  let totalProcessed = 0
  let totalCreated = 0
  let totalSkipped = 0

  // Preflight: verify target admin access works
  try {
    const { data: pre, error: preErr } = await target.auth.admin.listUsers({ page: 1, perPage: 1 })
    if (preErr) {
      console.warn(`Warning: target admin listUsers failed: ${preErr.message} (status: ${preErr.status})`)
    } else {
      console.log(`Target admin reachable. Sample users on target: ${pre.users?.length ?? 0}`)
    }
  } catch (e) {
    console.warn(`Warning: target admin preflight threw: ${e?.message || e}`)
  }

  while (true) {
    const { data, error } = await source.auth.admin.listUsers({ page, perPage: PAGE_SIZE })
    if (error) throw new Error(`Source listUsers failed on page ${page}: ${error.message}`)

    const users = data?.users || []
    if (users.length === 0) break

    for (const u of users) {
      totalProcessed++
      const email = u.email
      if (!email) {
        console.warn(`Skipping user without email: ${u.id}`)
        totalSkipped++
        continue
      }

      const createPayload = {
        email,
        email_confirm: true,
        user_metadata: u.user_metadata || {},
      }
      if (SET_TEMP_PASSWORD) {
        createPayload.password = TEMP_PASSWORD
      }

      if (DRY_RUN) {
        console.log(`[DRY_RUN] Would create → ${email}`)
      } else {
        if (CHECK_PROFILE_CONFLICTS) {
          await resolveProfileConflict(email)
        }
        const { data: created, error: createErr } = await target.auth.admin.createUser(createPayload)
        if (createErr) {
          // If already exists, Supabase returns 422 Unprocessable Entity
          if (createErr.status === 422) {
            console.log(`Exists → ${email} (skip)`) 
            totalSkipped++
            continue
          }
          const details = {
            status: createErr.status,
            name: createErr.name,
            message: createErr.message,
          }
          console.error(`Create failed for ${email}:`, details)

          // Attempt direct GoTrue admin call to capture raw error body from the server (often more specific)
          try {
            const url = `${TARGET_SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users`
            const resp = await fetch(url, {
              method: 'POST',
              headers: {
                'apikey': TARGET_SERVICE_ROLE,
                'Authorization': `Bearer ${TARGET_SERVICE_ROLE}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(createPayload),
            })
            const ct = resp.headers.get('content-type') || ''
            let body
            if (ct.includes('application/json')) {
              body = await resp.json()
            } else {
              body = await resp.text()
            }
            console.error(`Raw GoTrue response for ${email}:`, { status: resp.status, body })
          } catch (probeErr) {
            console.warn(`Probe call failed for ${email}: ${probeErr?.message || probeErr}`)
          }
          // Fallback A: try minimal payload (no metadata), keep email_confirm and password if set
          if (createErr.status === 500) {
            // Attempt to resolve duplicate profiles(email) conflicts, then retry
            const resolved = await resolveProfileConflict(email)

            const minimal = { email }
            if (SET_TEMP_PASSWORD) minimal.password = TEMP_PASSWORD
            if (createPayload.email_confirm) minimal.email_confirm = true
            try {
              const { data: c2, error: e2 } = await target.auth.admin.createUser(minimal)
              if (!e2) {
                totalCreated++
                console.log(`Created (minimal) → ${email} (${c2.user?.id || 'no-id'})`)
                // Optionally patch metadata after creation
                if (u.user_metadata && Object.keys(u.user_metadata).length > 0) {
                  const { error: updErr } = await target.auth.admin.updateUserById(c2.user.id, {
                    user_metadata: u.user_metadata,
                  })
                  if (updErr) {
                    console.warn(`Metadata update failed for ${email}: ${updErr.message}`)
                  }
                }
                // Password reset if requested
                if (SEND_PASSWORD_RESET) {
                  const { error: resetErr } = await target.auth.resetPasswordForEmail(email, { redirectTo: undefined })
                  if (resetErr) console.warn(`Reset email failed for ${email}: ${resetErr.message}`)
                }
                continue
              } else {
                console.error(`Minimal create failed for ${email}:`, { status: e2.status, name: e2.name, message: e2.message })
              }
            } catch (e) {
              console.warn(`Minimal create threw for ${email}: ${e?.message || e}`)
            }

            // Fallback B: email_confirm=false
            try {
              const variant = { email, email_confirm: false }
              if (SET_TEMP_PASSWORD) variant.password = TEMP_PASSWORD
              const { data: c3, error: e3 } = await target.auth.admin.createUser(variant)
              if (!e3) {
                totalCreated++
                console.log(`Created (confirm=false) → ${email} (${c3.user?.id || 'no-id'})`)
                if (u.user_metadata && Object.keys(u.user_metadata).length > 0) {
                  const { error: updErr } = await target.auth.admin.updateUserById(c3.user.id, {
                    user_metadata: u.user_metadata,
                  })
                  if (updErr) console.warn(`Metadata update failed for ${email}: ${updErr.message}`)
                }
                if (SEND_PASSWORD_RESET) {
                  const { error: resetErr } = await target.auth.resetPasswordForEmail(email, { redirectTo: undefined })
                  if (resetErr) console.warn(`Reset email failed for ${email}: ${resetErr.message}`)
                }
                continue
              } else {
                console.error(`Create (confirm=false) failed for ${email}:`, { status: e3.status, name: e3.name, message: e3.message })
              }
            } catch (e) {
              console.warn(`Create (confirm=false) threw for ${email}: ${e?.message || e}`)
            }

            // Fallback C: invite (only if SEND_PASSWORD_RESET is enabled)
            if (SEND_PASSWORD_RESET) {
              try {
                const { data: invite, error: invErr } = await target.auth.admin.inviteUserByEmail(email)
                if (!invErr) {
                  console.log(`Invited → ${email} (user will complete signup via email)`)
                  totalSkipped++ // Count as non-created insert, but progressed via invite
                  continue
                } else {
                  console.error(`Invite failed for ${email}:`, { status: invErr.status, name: invErr.name, message: invErr.message })
                }
              } catch (e) {
                console.warn(`Invite threw for ${email}: ${e?.message || e}`)
              }
            }
          }

          continue
        }
        totalCreated++
        console.log(`Created → ${email} (${created.user?.id || 'no-id'})`)

        if (SEND_PASSWORD_RESET) {
          const { error: resetErr } = await target.auth.resetPasswordForEmail(email, {
            redirectTo: undefined, // use project default site_url
          })
          if (resetErr) {
            console.warn(`Password reset email failed for ${email}: ${resetErr.message}`)
          } else {
            console.log(`Password reset email sent → ${email}`)
          }
        }
      }
    }

    page++
  }

  console.log(`\nDone.`)
  console.log(`Processed: ${totalProcessed}, Created: ${totalCreated}, Skipped: ${totalSkipped}`)
}

migrate().catch((e) => {
  console.error(e)
  process.exit(1)
})
