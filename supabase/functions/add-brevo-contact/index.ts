/// <reference path="../_shared/edge-env.d.ts" />
import { createLogger } from '../_shared/logger.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type AddContactRequest = {
  email: string
  firstName?: string
  lastName?: string
  listId?: number
  consentText?: string
  consentTs?: string
  ip?: string
  // Explicit consent switch to control company creation/linking
  consented?: boolean
  // Optional: pass arbitrary Brevo attributes to merge in
  attributes?: Record<string, string | number | boolean | string[]>
  // Optional convenience: map to Brevo attribute USER_TYPE
  userType?: 'VENUE' | 'MERCHANT' | string
  // When true, coerce USER_TYPE into an array for multi-select Category attributes
  userTypeMulti?: boolean
  // Optional: for CRM company association (phase 2)
  companyName?: string
  // Organization-centric model (preferred)
  organizationId?: string
  organizationName?: string
}

const supabaseHost = (() => {
  try {
    const u = Deno.env.get('SUPABASE_URL')
    return u ? new URL(u).host : undefined
  } catch {
    return undefined
  }
})()

Deno.serve({
  permissions: {
    net: ['api.brevo.com', ...(supabaseHost ? [supabaseHost] : [])]
  }
}, async (req) => {
  const baseLog = createLogger({ function: 'add-brevo-contact' })
  const log = baseLog.child({})

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 405 })
  }

  try {
    const brevoApiKey = Deno.env.get('BREVO_API_KEY')
    if (!brevoApiKey) {
      log.error('missing_api_key')
      return new Response(JSON.stringify({ error: 'BREVO_API_KEY not configured' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
    }

    const defaultListIdEnv = Deno.env.get('BREVO_LIST_ID_NEWSLETTER')
    const defaultListId = defaultListIdEnv ? Number(defaultListIdEnv) : undefined
    // Env-driven behavior for USER_TYPE normalization
    const userTypeIsMultiEnvRaw = Deno.env.get('BREVO_USER_TYPE_IS_MULTI') || ''
    const userTypeIsMultiEnv = ['1', 'true', 'yes', 'on'].includes(userTypeIsMultiEnvRaw.toLowerCase())
    const userTypeAllowedEnv = Deno.env.get('BREVO_USER_TYPE_ALLOWED') || 'MERCHANT,VENUE'
    const userTypeAllowed = userTypeAllowedEnv
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)

    let payload: AddContactRequest
    try {
      payload = await req.json()
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }

    const { email, firstName, lastName, listId, consentText, consentTs, ip, consented, attributes: extraAttributes, userType, userTypeMulti, companyName, organizationId, organizationName } = payload
    log.info('request_payload', { email, hasAttributes: !!extraAttributes, userType, companyName, organizationId, organizationName, listId: listId ?? defaultListId })
    if (!email) {
      return new Response(JSON.stringify({ error: 'email is required' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }

    const attributes: Record<string, string | number | boolean | string[]> = {}
    if (firstName) attributes.FIRSTNAME = firstName
    if (lastName) attributes.LASTNAME = lastName

    // Record consent context as attributes for compliance, but do NOT auto-consent.
    // Only set CONSENT_TS if provided or consented=true.
    if (consentText) attributes.CONSENT_TEXT = consentText
    if (consented || consentTs) attributes.CONSENT_TS = (consentTs || new Date().toISOString())
    if (ip && (consented || consentTs)) attributes.CONSENT_IP = ip

    // Merge extra attributes if provided
    if (extraAttributes && typeof extraAttributes === 'object') {
      for (const [k, v] of Object.entries(extraAttributes)) {
        // Only include primitive serializable values
        if (['string', 'number', 'boolean'].includes(typeof v)) {
          attributes[k.toUpperCase()] = v as any
        } else if (Array.isArray(v)) {
          // Allow string arrays (for multi-select category attributes)
          const allStrings = v.every((x) => typeof x === 'string')
          if (allStrings) {
            attributes[k.toUpperCase()] = (v as string[]).map((x) => String(x))
          }
        }
      }
    }

    // Map userType into a Brevo attribute if provided
    if (userType) {
      const normalized = String(userType).toUpperCase()
      if (normalized === 'VENUE' || normalized === 'MERCHANT') {
        attributes.USER_TYPE = normalized
      } else {
        // Allow custom strings to pass through as-is
        attributes.USER_TYPE = normalized
      }
    }

    // Normalize USER_TYPE shape and values
    // Determine if multi-select should be applied via env or per-request flag
    const isUserTypeMulti = !!(userTypeMulti || userTypeIsMultiEnv)
    {
      const raw = (attributes as any).USER_TYPE
      if (raw !== undefined) {
        if (isUserTypeMulti) {
          // Coerce to array of allowed, uppercase, unique values
          const arr = Array.isArray(raw) ? raw : (typeof raw === 'string' && raw ? [raw] : [])
          const upper = arr.filter(Boolean).map((s: any) => String(s).toUpperCase())
          const filtered = upper.filter((v) => userTypeAllowed.includes(v))
          const unique = Array.from(new Set(filtered))
          if (unique.length === 0) {
            // Remove invalid/empty USER_TYPE rather than sending bad values to Brevo
            delete (attributes as any).USER_TYPE
            log.warn('user_type_validation_filtered_all', { provided: upper, allowed: userTypeAllowed })
          } else {
            ;(attributes as any).USER_TYPE = unique
          }
        } else {
          // Single-select: coerce to single uppercase string and validate
          const val = Array.isArray(raw) ? raw.find((x: any) => !!x) : raw
          const up = val ? String(val).toUpperCase() : ''
          if (up && userTypeAllowed.includes(up)) {
            ;(attributes as any).USER_TYPE = up
          } else if (up) {
            delete (attributes as any).USER_TYPE
            log.warn('user_type_validation_invalid_single', { provided: up, allowed: userTypeAllowed })
          }
        }
      }
    }

    const body = {
      email,
      attributes,
      updateEnabled: true,
      listIds: [ listId ?? defaultListId ].filter(Boolean) as number[],
    }
    log.info('brevo_outbound', { email, attributes, listCount: body.listIds.length, companyName })

    const res = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': brevoApiKey,
      },
      body: JSON.stringify(body),
    })

    const text = await res.text()
    if (!res.ok) {
      log.error('brevo_error', { status: res.status, text: text?.slice(0, 300) })
      return new Response(JSON.stringify({ success: false, status: res.status, error: text }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }
    log.info('brevo_success', { status: res.status, text: text?.slice(0, 200) })

    let json: any
    try { json = text ? JSON.parse(text) : {} } catch { json = { raw: text } }
    // Capture contactId directly from create/update response when available
    let createdContactId: number | undefined =
      (typeof json?.id === 'number' ? json.id : undefined) ??
      (typeof json?.contact?.id === 'number' ? json.contact.id : undefined)

    // Force-persist attributes (especially USER_TYPE) to the contact to avoid Brevo ignoring unknown attributes on first create
    // Small delay to avoid immediate post-create race conditions
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
    try {
      await sleep(300)
      const payload = { attributes, updateEnabled: true }
      // First, try by email (identifierType=email_id)
      let attrRes = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}?identifierType=email_id`, {
        method: 'PUT',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'api-key': brevoApiKey,
        },
        body: JSON.stringify(payload),
      })
      let attrText = await attrRes.text()
      let attrJson: any
      try { attrJson = attrText ? JSON.parse(attrText) : {} } catch { attrJson = { raw: attrText } }
      if (!attrRes.ok && createdContactId) {
        // Fallback: try by contact_id if we have it
        log.warn('crm_contact_attributes_update_retry_contact_id', { firstStatus: attrRes.status, firstBody: attrText?.slice(0, 300), contactId: createdContactId })
        attrRes = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(String(createdContactId))}?identifierType=contact_id`, {
          method: 'PUT',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'api-key': brevoApiKey,
          },
          body: JSON.stringify(payload),
        })
        attrText = await attrRes.text()
        try { attrJson = attrText ? JSON.parse(attrText) : {} } catch { attrJson = { raw: attrText } }
      }
      if (!attrRes.ok) {
        log.warn('crm_contact_attributes_update_failed', { status: attrRes.status, body: attrJson })
      } else {
        log.info('crm_contact_attributes_update_success', { status: attrRes.status, body: attrJson })
      }
    } catch (e: any) {
      log.warn('crm_contact_attributes_update_exception', { err: String(e?.message || e) })
    }

    // Determine consent for company creation/linking
    const hasConsent = !!(consented || (attributes as any)?.CONSENT_TS || consentTs)

    // Phase 1: Resolve Organization (preferred) and conditionally upsert Brevo CRM Company
    let companyUpsert: { companyId?: string, action?: 'found' | 'created', error?: string } | undefined
    let duplicateCompanyIds: string[] = []
    // Helpers for Supabase REST
    const supabaseUrlForOrg = Deno.env.get('SUPABASE_URL')
    const serviceKeyForOrg = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const norm = (s: string) => String(s || '').trim().replace(/\s+/g, ' ')
    const isUuid = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)

    let resolvedOrg: { id: string, name: string, brevo_company_id?: string } | undefined
    try {
      if ((organizationId || organizationName) && supabaseUrlForOrg && serviceKeyForOrg) {
        if (organizationId && isUuid(organizationId)) {
          const orgRes = await fetch(`${supabaseUrlForOrg}/rest/v1/organizations?id=eq.${encodeURIComponent(organizationId)}&select=id,name,brevo_company_id`, {
            headers: { 'apikey': serviceKeyForOrg, 'Authorization': `Bearer ${serviceKeyForOrg}`, 'Accept': 'application/json' },
          })
          if (orgRes.ok) {
            const arr: any[] = await orgRes.json()
            if (arr?.[0]) resolvedOrg = arr[0]
          }
        }
        if (!resolvedOrg && organizationName && organizationName.trim()) {
          const normalized = norm(organizationName)
          // Try find by name first
          const findRes = await fetch(`${supabaseUrlForOrg}/rest/v1/organizations?select=id,name,brevo_company_id&name=eq.${encodeURIComponent(normalized)}`, {
            headers: { 'apikey': serviceKeyForOrg, 'Authorization': `Bearer ${serviceKeyForOrg}`, 'Accept': 'application/json' },
          })
          if (findRes.ok) {
            const list: any[] = await findRes.json()
            if (list?.[0]) {
              resolvedOrg = list[0]
            } else {
              // Create organization
              const insRes = await fetch(`${supabaseUrlForOrg}/rest/v1/organizations`, {
                method: 'POST',
                headers: { 'apikey': serviceKeyForOrg, 'Authorization': `Bearer ${serviceKeyForOrg}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
                body: JSON.stringify({ name: normalized })
              })
              const t = await insRes.text()
              let js: any; try { js = t ? JSON.parse(t) : {} } catch { js = { raw: t } }
              if (insRes.ok) {
                const row = Array.isArray(js) ? js[0] : js
                if (row?.id) resolvedOrg = row
              } else {
                log.warn('org_create_failed', { status: insRes.status, text: t?.slice(0,300) })
              }
            }
          }
        }
      }
    } catch (e: any) {
      log.warn('org_resolve_exception', { err: String(e?.message || e) })
    }

    // If we have an org, prefer its name for company operations
    let effectiveCompanyName = companyName
    if (resolvedOrg?.name) effectiveCompanyName = resolvedOrg.name

    if (effectiveCompanyName && effectiveCompanyName.trim() && hasConsent) {
      try {
        // If we already stored a company ID for this user, update that company name instead of creating a new one
        const extIdForCompany = (attributes as any)?.EXT_ID || (extraAttributes as any)?.EXT_ID
        let skipSearchCreate = false
        // Prefer organization.brevo_company_id if available
        if (resolvedOrg?.brevo_company_id) {
          companyUpsert = { companyId: String(resolvedOrg.brevo_company_id), action: 'found' }
          log.info('crm_company_from_org', { organizationId: resolvedOrg.id, companyId: resolvedOrg.brevo_company_id })
          skipSearchCreate = true
        }

        // Canonical override: allow mapping name -> fixed companyId via env
        const canonRaw = Deno.env.get('BREVO_COMPANY_CANON') || ''
        const parseCanon = (raw: string): Record<string, string> => {
          try {
            if (!raw) return {}
            if (raw.trim().startsWith('{')) {
              const obj = JSON.parse(raw)
              const out: Record<string, string> = {}
              for (const [k, v] of Object.entries(obj || {})) {
                out[String(k).trim().toLowerCase()] = String(v)
              }
              return out
            }
            const out: Record<string, string> = {}
            for (const part of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
              const [name, id] = part.split(':')
              if (name && id) out[name.trim().toLowerCase()] = id.trim()
            }
            return out
          } catch {
            return {}
          }
        }
        const canonMap = parseCanon(canonRaw)

        // Helper: robust company finder with pagination fallback + optional fuzzy contains
        const normalizedCompanyName = effectiveCompanyName.trim().replace(/\s+/g, ' ')
        const allowFuzzy = (Deno.env.get('BREVO_COMPANY_FUZZY_OK') || 'false').toLowerCase() === 'true'
        const debugFind = (Deno.env.get('BREVO_COMPANY_FIND_DEBUG') || 'false').toLowerCase() === 'true'
        const allowCreate = (Deno.env.get('BREVO_COMPANY_ALLOW_CREATE') || 'true').toLowerCase() !== 'false'
        const fetchCompaniesByName = async (name: string): Promise<any[]> => {
          if (skipSearchCreate) return []
          // Try search API first
          try {
            const searchBody = {
              filters: { name: { operator: 'equals', value: name } },
              page: 1,
              limit: 50,
            }
            const res = await fetch('https://api.brevo.com/v3/companies/search', {
              method: 'POST',
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'api-key': brevoApiKey,
              },
              body: JSON.stringify(searchBody),
            })
            const txt = await res.text()
            let js: any; try { js = txt ? JSON.parse(txt) : {} } catch { js = { raw: txt } }
            const items = Array.isArray(js?.items) ? js.items : []
            if (debugFind) log.info('crm_company_find_trace', { phase: 'search', ok: res.ok, items: items.length })
            if (items.length > 0) return items
          } catch (e: any) {
            log.warn('crm_company_search_exception', { err: String(e?.message || e) })
          }
          // Fallback: paginate list up to 10 pages x 100 items
          const matches: any[] = []
          const fuzzy: any[] = []
          for (let page = 1; page <= 10; page++) {
            const url = `https://api.brevo.com/v3/companies?page=${page}&limit=100`
            const listRes = await fetch(url, {
              method: 'GET',
              headers: {
                'Accept': 'application/json',
                'api-key': brevoApiKey,
              },
            })
            const listText = await listRes.text()
            let listJson: any
            try { listJson = listText ? JSON.parse(listText) : {} } catch { listJson = { raw: listText } }
            if (!listRes.ok) {
              log.warn('crm_company_search_failed', { page, status: listRes.status, text: listText?.slice(0, 200) })
              break
            }
            const items = Array.isArray(listJson?.items) ? listJson.items : []
            if (items.length === 0) break
            const eq = (s: string) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase() === name.toLowerCase()
            const contains = (s: string) => String(s || '').toLowerCase().includes(name.toLowerCase())
            for (const it of items) {
              if (eq(it?.name)) matches.push(it)
              else if (allowFuzzy && contains(it?.name)) fuzzy.push(it)
            }
            // If we found matches we can stop early
            if (debugFind) log.info('crm_company_find_page', { page, size: items.length, exactFound: matches.length, fuzzyFound: allowFuzzy ? fuzzy.length : undefined })
            if (matches.length > 0) break
          }
          if (matches.length > 0) return matches
          if (allowFuzzy && fuzzy.length > 0) {
            // Prefer most recently modified if available
            try {
              fuzzy.sort((a: any, b: any) => new Date(b?.updatedAt || b?.modifiedAt || 0).getTime() - new Date(a?.updatedAt || a?.modifiedAt || 0).getTime())
            } catch {}
            if (debugFind) log.info('crm_company_find_trace', { phase: 'fuzzy_fallback', count: fuzzy.length })
            return fuzzy
          }
          return []
        }

        let found: any | undefined
        // Canonical fast-path: if name is mapped to a companyId, use it and collect duplicates for unlink
        const canonId = canonMap[normalizedCompanyName.toLowerCase()]
        let allMatches: any[] = []
        if (canonId) {
          found = { id: canonId, name: normalizedCompanyName }
          log.info('crm_company_canonical_override', { name: normalizedCompanyName, companyId: canonId })
          // Attempt to list companies to identify duplicates to unlink
          try {
            const listRes = await fetch('https://api.brevo.com/v3/companies?page=1&limit=100', {
              method: 'GET',
              headers: { 'Accept': 'application/json', 'api-key': brevoApiKey },
            })
            const listText = await listRes.text()
            let listJson: any
            try { listJson = listText ? JSON.parse(listText) : {} } catch { listJson = { raw: listText } }
            const items = Array.isArray(listJson?.items) ? listJson.items : []
            const eq = (s: string) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase() === normalizedCompanyName.toLowerCase()
            const matches = items.filter((it: any) => eq(it?.attributes?.name || it?.name))
            allMatches = matches
            duplicateCompanyIds = matches.map((it: any) => String(it.id)).filter((id: string) => id && id !== canonId)
            if (duplicateCompanyIds.length > 0) {
              log.warn('crm_company_duplicates_detected_canon', { name: normalizedCompanyName, count: matches.length, duplicateCompanyIds })
            }
          } catch (e: any) {
            log.warn('crm_company_canonical_list_exception', { err: String(e?.message || e) })
          }
        } else {
          allMatches = await fetchCompaniesByName(normalizedCompanyName)
        }
        if (allMatches.length > 0) {
          found = allMatches[0]
          if (allMatches.length > 1) {
            duplicateCompanyIds = allMatches.slice(1).map((it: any) => String(it.id)).filter(Boolean)
            log.warn('crm_company_duplicates_detected', { name: normalizedCompanyName, count: allMatches.length, duplicateCompanyIds })
          }
        }
        if (!skipSearchCreate && found?.id) {
          companyUpsert = { companyId: String(found.id), action: 'found' }
          log.info('crm_company_found', { companyId: found.id, name: effectiveCompanyName })
        } else if (!skipSearchCreate) {
          // Create company
          if (!allowCreate) {
            log.warn('crm_company_create_skipped', { reason: 'creation_disabled_by_env', name: normalizedCompanyName })
            companyUpsert = { error: 'creation_disabled' }
          } else {
            if (debugFind) log.info('crm_company_create_reason', { reason: 'not_found_after_search_and_pagination', name: normalizedCompanyName })
          const createRes = await fetch('https://api.brevo.com/v3/companies', {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'api-key': brevoApiKey,
            },
            body: JSON.stringify({ name: effectiveCompanyName.trim() }),
          })
          const createText = await createRes.text()
          let createJson: any
          try { createJson = createText ? JSON.parse(createText) : {} } catch { createJson = { raw: createText } }
          if (!createRes.ok) {
            log.warn('crm_company_create_failed', { status: createRes.status, text: createText?.slice(0, 300) })
            companyUpsert = { error: `create_failed_${createRes.status}` }
          } else {
            const createdId = createJson?.id || createJson?.company?.id
            if (createdId) {
              companyUpsert = { companyId: String(createdId), action: 'created' }
              log.info('crm_company_created', { companyId: createdId, name: effectiveCompanyName })
            } else {
              log.warn('crm_company_create_no_id', { response: createJson })
              companyUpsert = { error: 'create_no_id' }
            }
          }
          }
        }
      } catch (e: any) {
        log.warn('crm_company_upsert_exception', { err: String(e?.message || e) })
        companyUpsert = { error: 'exception' }
      }
    } else if (effectiveCompanyName && effectiveCompanyName.trim() && !hasConsent) {
      log.info('crm_company_skipped_due_to_no_consent', { name: effectiveCompanyName })
    }

    // Phase 2: Associate Brevo contact with the company (if we have both)
    try {
      if (companyUpsert?.companyId) {
        // Determine contactId
        let contactId: number | undefined = createdContactId
        // If not present from create/update, fetch by email (identifierType=email_id)
        const contactRes = contactId ? new Response(JSON.stringify({ id: contactId }), { status: 200 }) as Response : await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}?identifierType=email_id`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'api-key': brevoApiKey,
          },
        })
        const contactText = await contactRes.text()
        let contactJson: any
        try { contactJson = contactText ? JSON.parse(contactText) : {} } catch { contactJson = { raw: contactText } }
        if (!contactRes.ok) {
          log.warn('crm_contact_lookup_failed', { status: contactRes.status, text: contactText?.slice(0, 300) })
          // Fallback: try without identifierType
          const fallbackRes = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'api-key': brevoApiKey,
            },
          })
          const fallbackText = await fallbackRes.text()
          let fallbackJson: any
          try { fallbackJson = fallbackText ? JSON.parse(fallbackText) : {} } catch { fallbackJson = { raw: fallbackText } }
          if (!fallbackRes.ok) {
            log.warn('crm_contact_lookup_failed_no_identifier', { status: fallbackRes.status, text: fallbackText?.slice(0, 300) })
          } else {
            contactId = typeof fallbackJson?.id === 'number' ? fallbackJson.id : (typeof fallbackJson?.contact?.id === 'number' ? fallbackJson.contact.id : undefined)
          }
        } else {
          contactId = typeof contactJson?.id === 'number' ? contactJson.id : (typeof contactJson?.contact?.id === 'number' ? contactJson.contact.id : undefined)
        }

        if (contactId) {
          // Link the contact to the company (use numeric IDs)
          const linkBody = {
            linkContactIds: [contactId],
            unlinkContactIds: [],
          }
          let linked = false
          for (let attempt = 1; attempt <= 3 && !linked; attempt++) {
            let linkRes = await fetch(`https://api.brevo.com/v3/companies/link-unlink/${encodeURIComponent(companyUpsert.companyId)}`, {
              method: 'PATCH',
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'api-key': brevoApiKey,
              },
              body: JSON.stringify(linkBody),
            })
            let linkText = await linkRes.text()
            if (!linkRes.ok && linkRes.status === 400 && linkText?.includes('Invalid contactID')) {
              // Retry with alternative payload shape
              const altBody = { linkContacts: [{ id: contactId }], unlinkContacts: [] as any[] }
              const altRes = await fetch(`https://api.brevo.com/v3/companies/link-unlink/${encodeURIComponent(companyUpsert.companyId)}`, {
                method: 'PATCH',
                headers: {
                  'Accept': 'application/json',
                  'Content-Type': 'application/json',
                  'api-key': brevoApiKey,
                },
                body: JSON.stringify(altBody),
              })
              const altText = await altRes.text()
              if (!altRes.ok) {
                log.warn('crm_company_link_failed_alt', { status: altRes.status, text: altText?.slice(0, 300), attempted: 'linkContacts', attempt })
                // Retry with stringified ID
                const idStringBody = { linkContactIds: [String(contactId)], unlinkContactIds: [] as any[] }
                const idStringRes = await fetch(`https://api.brevo.com/v3/companies/link-unlink/${encodeURIComponent(companyUpsert.companyId)}`, {
                  method: 'PATCH',
                  headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'api-key': brevoApiKey,
                  },
                  body: JSON.stringify(idStringBody),
                })
                const idStringText = await idStringRes.text()
                if (!idStringRes.ok) {
                  log.warn('crm_company_link_failed_id_string', { status: idStringRes.status, text: idStringText?.slice(0, 300), attempt })
                  // Final fallback: use email directly if API supports it
                  const emailBody: any = { linkContactEmails: [email], unlinkContactEmails: [] }
                  const emailRes = await fetch(`https://api.brevo.com/v3/companies/link-unlink/${encodeURIComponent(companyUpsert.companyId)}`, {
                    method: 'PATCH',
                    headers: {
                      'Accept': 'application/json',
                      'Content-Type': 'application/json',
                      'api-key': brevoApiKey,
                    },
                    body: JSON.stringify(emailBody),
                  })
                  const emailText = await emailRes.text()
                  if (!emailRes.ok) {
                    log.warn('crm_company_link_failed_email', { status: emailRes.status, text: emailText?.slice(0, 300), attempt })
                  } else {
                    log.info('crm_company_link_success', { companyId: companyUpsert.companyId, via: 'email', attempt })
                    linked = true
                  }
                } else {
                  log.info('crm_company_link_success', { companyId: companyUpsert.companyId, contactId, attempted: 'id_string', attempt })
                  linked = true
                }
              } else {
                log.info('crm_company_link_success', { companyId: companyUpsert.companyId, contactId, attempted: 'linkContacts', attempt })
                linked = true
              }
            } else if (!linkRes.ok) {
              log.warn('crm_company_link_failed', { status: linkRes.status, text: linkText?.slice(0, 300), attempt })
            } else {
              log.info('crm_company_link_success', { companyId: companyUpsert.companyId, contactId, attempt })
              linked = true
            }
            if (!linked && attempt < 3) {
              const backoffMs = attempt === 1 ? 300 : 800
              await new Promise((r) => setTimeout(r, backoffMs))
            }
          }
          // If there are duplicate companies with the same name, unlink the contact from those
          if (duplicateCompanyIds.length > 0) {
            for (const dupId of duplicateCompanyIds) {
              try {
                const unlinkBody = { linkContactIds: [], unlinkContactIds: [contactId] }
                const unlinkRes = await fetch(`https://api.brevo.com/v3/companies/link-unlink/${encodeURIComponent(dupId)}`, {
                  method: 'PATCH',
                  headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'api-key': brevoApiKey,
                  },
                  body: JSON.stringify(unlinkBody),
                })
                const unlinkText = await unlinkRes.text()
                if (!unlinkRes.ok) {
                  log.warn('crm_company_unlink_failed', { companyId: dupId, status: unlinkRes.status, text: unlinkText?.slice(0, 300) })
                } else {
                  log.info('crm_company_unlink_success', { companyId: dupId, contactId })
                }
              } catch (e: any) {
                log.warn('crm_company_unlink_exception', { companyId: dupId, err: String(e?.message || e) })
              }
            }
          }
        } else {
          // Only log a safe subset so we don't leak PII
          const shape = contactJson && typeof contactJson === 'object' ? Object.keys(contactJson).slice(0, 10) : contactJson
          log.warn('crm_contact_lookup_no_id', { keys: shape })
        }
      }
    } catch (e: any) {
      log.warn('crm_company_link_exception', { err: String(e?.message || e) })
    }

    // Persist the companyId to Supabase where appropriate
    try {
      const extId = (attributes as any)?.EXT_ID || (extraAttributes as any)?.EXT_ID
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      const isUuid2 = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
      if (companyUpsert?.companyId && supabaseUrl && serviceKey) {
        // If we resolved an organization, store brevo_company_id there
        if (resolvedOrg?.id && isUuid2(resolvedOrg.id)) {
          const orgPatch = await fetch(`${supabaseUrl}/rest/v1/organizations?id=eq.${encodeURIComponent(resolvedOrg.id)}`, {
            method: 'PATCH',
            headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify({ brevo_company_id: companyUpsert.companyId })
          })
          if (!orgPatch.ok) {
            const t = await orgPatch.text()
            log.warn('db_update_org_brevo_company_id_failed', { status: orgPatch.status, text: t?.slice(0, 300) })
          } else {
            log.info('db_update_org_brevo_company_id_success', { organizationId: resolvedOrg.id, companyId: companyUpsert.companyId })
          }
        }
      }
    } catch (e: any) {
      log.warn('db_update_brevo_company_id_exception', { err: String(e?.message || e) })
    }

    // Ensure membership (if we have both profile EXT_ID and resolved organization)
    try {
      const extId = (attributes as any)?.EXT_ID || (extraAttributes as any)?.EXT_ID
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      const isUuid3 = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
      if (resolvedOrg?.id && isUuid3(resolvedOrg.id) && isUuid3(extId) && supabaseUrl && serviceKey) {
        // Check if membership exists
        const existRes = await fetch(`${supabaseUrl}/rest/v1/organization_members?organization_id=eq.${encodeURIComponent(resolvedOrg.id)}&user_id=eq.${encodeURIComponent(extId)}`, {
          headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Accept': 'application/json' },
        })
        if (existRes.ok) {
          const arr: any[] = await existRes.json()
          if (!arr?.[0]) {
            const insRes = await fetch(`${supabaseUrl}/rest/v1/organization_members`, {
              method: 'POST',
              headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
              body: JSON.stringify({ organization_id: resolvedOrg.id, user_id: extId, role: 'member' })
            })
            if (!insRes.ok) {
              const t = await insRes.text()
              log.warn('db_insert_org_member_failed', { status: insRes.status, text: t?.slice(0, 300) })
            } else {
              log.info('db_insert_org_member_success', { organizationId: resolvedOrg.id, userId: extId })
            }
          }
        }
      }
    } catch (e: any) {
      log.warn('db_org_membership_exception', { err: String(e?.message || e) })
    }

    return new Response(
      JSON.stringify({ success: true, result: json, echoed: { email, attributes, companyName, organizationId: resolvedOrg?.id || organizationId, organizationName: resolvedOrg?.name || organizationName }, companyUpsert }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (e: any) {
    log.error('unexpected_error', { err: String(e?.message || e) })
    return new Response(JSON.stringify({ error: 'Internal error' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
  }
})
