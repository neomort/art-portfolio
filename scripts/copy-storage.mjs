import { createClient } from '@supabase/supabase-js'

// Usage:
//   SRC_SERVICE_ROLE=... DST_SERVICE_ROLE=... node scripts/copy-storage.mjs
// Optional env:
//   SRC_URL (default: https://coandrdclvjebyoadoau.supabase.co)
//   DST_URL (default: https://zokshdfhunkvxdarrqjw.supabase.co)
//   BUCKET  (default: property-images)
//   CONCURRENCY (default: 4)

const SRC_URL = process.env.SRC_URL || 'https://coandrdclvjebyoadoau.supabase.co'
const DST_URL = process.env.DST_URL || 'https://zokshdfhunkvxdarrqjw.supabase.co'
const BUCKET = process.env.BUCKET || 'property-images'
const CONCURRENCY = Number(process.env.CONCURRENCY || 4)

if (!process.env.SRC_SERVICE_ROLE || !process.env.DST_SERVICE_ROLE) {
  console.error('Missing SRC_SERVICE_ROLE or DST_SERVICE_ROLE env vars')
  process.exit(1)
}

const src = createClient(SRC_URL, process.env.SRC_SERVICE_ROLE)
const dst = createClient(DST_URL, process.env.DST_SERVICE_ROLE)

async function listRecursive(prefix = '') {
  const results = []
  let offset = 0
  const limit = 1000
  while (true) {
    const { data, error } = await src.storage.from(BUCKET).list(prefix, { limit, offset })
    if (error) throw error
    if (!data || data.length === 0) break
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name
      // Heuristic: folders usually have null metadata; files have metadata with size/mimetype
      const isFolder = !entry.metadata || (entry.metadata && entry.metadata.size === undefined)
      if (isFolder) {
        const nested = await listRecursive(path)
        results.push(...nested)
      } else {
        results.push(path)
      }
    }
    if (data.length < limit) break
    offset += data.length
  }
  return results
}

async function copyOne(path) {
  const { data: file, error: dErr } = await src.storage.from(BUCKET).download(path)
  if (dErr) {
    console.error('download failed', path, dErr.message)
    return false
  }
  const { error: uErr } = await dst.storage.from(BUCKET).upload(path, file, { upsert: true })
  if (uErr) {
    console.error('upload failed', path, uErr.message)
    return false
  }
  return true
}

async function runWithConcurrency(paths) {
  let idx = 0
  let ok = 0
  let fail = 0
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (true) {
      const i = idx++
      if (i >= paths.length) return
      const p = paths[i]
      const res = await copyOne(p)
      if (res) { ok++; console.log('copied', p) } else { fail++ }
    }
  })
  await Promise.all(workers)
  return { ok, fail }
}

async function main() {
  console.log('Listing objects from bucket', BUCKET, 'on', SRC_URL)
  const paths = await listRecursive('')
  console.log('Found', paths.length, 'files')
  const { ok, fail } = await runWithConcurrency(paths)
  console.log('Done. Success:', ok, 'Failed:', fail)
}

main().catch((e) => { console.error(e); process.exit(1) })
