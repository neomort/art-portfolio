#!/usr/bin/env node
/*
  Cleanup Brevo companies (and optionally contacts) for test environments.

  Usage examples:
    node scripts/cleanup-brevo-companies.mjs                # dry-run delete ALL companies
    node scripts/cleanup-brevo-companies.mjs --execute      # actually delete ALL companies
    node scripts/cleanup-brevo-companies.mjs --name "X Factor"          # dry-run delete by exact name
    node scripts/cleanup-brevo-companies.mjs --name "X Factor" --execute

  Requires env var:
    BREVO_API_KEY=<your key>

  Notes:
  - We first unlink any linked contacts from each company (PATCH /companies/link-unlink/:id),
    then DELETE /companies/:id.
  - Pagination: fetches pages of 100 companies until exhausted.
  - Matches are by exact, normalized name (trim + collapse whitespace + lower-case).
*/

const API = 'https://api.brevo.com/v3'

function getEnv(key, required = false) {
  const v = process.env[key]
  if (!v && required) {
    console.error(`Missing required env: ${key}`)
    process.exit(1)
  }
  return v
}

const argv = (() => {
  const out = { execute: false, name: null }
  const args = process.argv.slice(2)
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--execute' || a === '-x') out.execute = true
    else if (a === '--name' || a === '-n') { out.name = args[i + 1]; i++ }
    else if (a === '--help' || a === '-h') out.help = true
  }
  return out
})()

if (argv.help) {
  console.log(`Cleanup Brevo companies\n\n` +
`Usage:\n` +
`  node scripts/cleanup-brevo-companies.mjs [--name "X Factor"] [--execute]\n\n` +
`Env:\n` +
`  BREVO_API_KEY  Required\n`)
  process.exit(0)
}

const API_KEY = getEnv('BREVO_API_KEY', true)

const headers = {
  'accept': 'application/json',
  'content-type': 'application/json',
  'api-key': API_KEY,
}

function norm(s) {
  return String(s || '').trim().replace(/\s+/g, ' ').toLowerCase()
}

async function listCompanies({ page = 1, limit = 100 } = {}) {
  const res = await fetch(`${API}/companies?page=${page}&limit=${limit}`, { headers })
  const text = await res.text()
  let json
  try { json = text ? JSON.parse(text) : {} } catch { json = { raw: text } }
  if (!res.ok) throw new Error(`List companies failed: ${res.status} ${text?.slice(0,200)}`)
  const items = Array.isArray(json?.items) ? json.items : []
  const pager = json?.pager || {}
  return { items, pager }
}

async function unlinkAllContacts(company) {
  const ids = Array.isArray(company?.linkedContactsIds) ? company.linkedContactsIds : []
  if (ids.length === 0) return { skipped: true }
  const body = { linkContactIds: [], unlinkContactIds: ids }
  const res = await fetch(`${API}/companies/link-unlink/${encodeURIComponent(company.id)}`, {
    method: 'PATCH', headers, body: JSON.stringify(body)
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Unlink contacts failed for ${company.id}: ${res.status} ${text?.slice(0,200)}`)
  return { ok: true }
}

async function deleteCompany(id) {
  const res = await fetch(`${API}/companies/${encodeURIComponent(id)}`, { method: 'DELETE', headers })
  const text = await res.text()
  if (!res.ok) throw new Error(`Delete company failed for ${id}: ${res.status} ${text?.slice(0,200)}`)
  return { ok: true }
}

async function main() {
  const targetName = argv.name ? norm(argv.name) : null
  console.log(`Mode: ${argv.execute ? 'EXECUTE (will delete)' : 'DRY-RUN'}\n` +
              (targetName ? `Filter: name == ${argv.name}\n` : 'Filter: ALL companies\n'))

  // Collect all companies
  let page = 1
  const toDelete = []
  while (true) {
    const { items, pager } = await listCompanies({ page, limit: 100 })
    if (items.length === 0) break
    for (const it of items) {
      const name = it?.attributes?.name || it?.name
      if (!targetName || norm(name) === targetName) {
        toDelete.push(it)
      }
    }
    const max = pager?.max || Math.ceil((pager?.total || 0) / (pager?.limit || 100))
    if (!max || page >= max) break
    page++
  }

  console.log(`Found ${toDelete.length} compan${toDelete.length === 1 ? 'y' : 'ies'} to delete.`)

  if (!argv.execute) {
    for (const c of toDelete) {
      console.log(`DRY-RUN delete: id=${c.id} name=${c?.attributes?.name || c?.name} contacts=${(c.linkedContactsIds||[]).length}`)
    }
    console.log(`\nRe-run with --execute to perform deletion.`)
    return
  }

  // Execute: unlink then delete
  for (const c of toDelete) {
    const name = c?.attributes?.name || c?.name
    const contactCount = (c.linkedContactsIds || []).length
    if (contactCount > 0) {
      console.log(`Unlinking ${contactCount} contacts from ${name} (${c.id}) ...`)
      try {
        await unlinkAllContacts(c)
        console.log(`Unlinked ${contactCount} contacts from ${name} (${c.id})`)
      } catch (e) {
        console.error(`Failed to unlink for ${c.id}: ${e?.message || e}`)
        // Continue to attempt delete anyway; Brevo may allow it.
      }
    }
    console.log(`Deleting company ${name} (${c.id}) ...`)
    try {
      await deleteCompany(c.id)
      console.log(`Deleted company ${name} (${c.id})`)
    } catch (e) {
      console.error(`Failed to delete ${c.id}: ${e?.message || e}`)
    }
  }

  console.log('Done.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
