// @ts-nocheck: Edge Function with Deno runtime - TypeScript checking disabled for compatibility
// Remove unused import to fix lint error

// CORS: Allow dynamic origin for local dev and a configurable allowlist via FRONTEND_URLS or FRONTEND_URL
Deno.serve({ permissions: { net: ["*.supabase.co", "*"] } }, async (req) => {
  const origin = req.headers.get('Origin') || req.headers.get('origin') || ''
  const allowlist = (Deno.env.get('FRONTEND_URLS') || Deno.env.get('FRONTEND_URL') || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const isLocalhost = origin.startsWith('http://localhost:') || origin.startsWith('https://localhost:')
  const isAllowed = (origin && allowlist.includes(origin)) || isLocalhost
  const corsHeaders = {
    'Access-Control-Allow-Origin': isAllowed && origin ? origin : 'http://localhost:5173',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
  }
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const icalUrls = body.icalUrls || []
    
    if (!Array.isArray(icalUrls) || icalUrls.length === 0) {
      return new Response(
        JSON.stringify({ events: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Fetch and parse all iCal URLs
    const allEvents = []
    const errors = []

    for (let i = 0; i < icalUrls.length; i++) {
      const icalUrl = icalUrls[i]
      try {
        const response = await fetch(icalUrl, {
          headers: {
            'User-Agent': 'SplitSpace-Calendar-Sync/1.0',
            'Accept': 'text/calendar,text/plain',
          },
          timeout: 10000,
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const icalData = await response.text()
        
        if (!icalData.trim()) {
          throw new Error('Empty iCal data received')
        }

        const parseResult = parseICalData(icalData, icalUrl)
        allEvents.push(...parseResult)

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.error('Failed to fetch or parse iCal URL:', errorMsg)
        errors.push({ url: icalUrl, error: errorMsg })
      }
    }

    return new Response(
      JSON.stringify({ events: allEvents }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

// Simple iCal parser - extracts basic event information
function parseICalData(icalData: string, sourceUrl: string) {
  const events = []
  const lines = icalData.split(/\r?\n/)
  let currentEvent: Record<string, string> = {}
  let inEvent = false
  
  // Extract timezone from iCal data
  let timezone = 'UTC' // default
  for (const line of lines) {
    if (line.startsWith('X-WR-TIMEZONE:')) {
      timezone = line.split(':')[1]
      break
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    if (line === 'BEGIN:VEVENT') {
      inEvent = true
      currentEvent = {}
      continue
    }
    
    if (line === 'END:VEVENT') {
      if (inEvent && currentEvent.dtstart && currentEvent.dtend) {
        
        // Convert to our event format
        const event = {
          id: `external-${sourceUrl}-${currentEvent.uid || crypto.randomUUID()}`,
          start: formatICalDate(currentEvent.dtstart, timezone),
          end: formatICalDate(currentEvent.dtend, timezone),
          summary: currentEvent.summary || 'Unavailable',
          description: currentEvent.description || '',
          location: currentEvent.location || '',
          isExternal: true,
          sourceUrl: sourceUrl,
        }
        
        // Only include events that are in the future or recent past (last 365 days)
        const eventStart = new Date(event.start)
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 365)
        
        if (eventStart >= thirtyDaysAgo) {
          events.push(event)
        }
      }
      inEvent = false
      currentEvent = {}
      continue
    }
    
    if (inEvent && line.includes(':')) {
      const [key, ...valueParts] = line.split(':')
      const value = valueParts.join(':')
      
      // Handle folded lines (lines that start with a space)
      if (key.startsWith(' ')) {
        const lastKey = Object.keys(currentEvent).pop()
        if (lastKey) {
          currentEvent[lastKey] += value
        }
        continue
      }
      
      switch (key) {
        case 'DTSTART':
          currentEvent.dtstart = value
          break
        case 'DTEND':
          currentEvent.dtend = value
          break
        case 'UID':
          currentEvent.uid = value
          break
        case 'SUMMARY':
          currentEvent.summary = value
          break
        case 'DESCRIPTION':
          currentEvent.description = value
          break
        case 'LOCATION':
          currentEvent.location = value
          break
      }
    }
  }
  
  return events
}

// Convert iCal date format to ISO string
function formatICalDate(icalDate: string, timezone: string): string {
  // Handle both basic format (20251225T100000) and UTC format (20251225T100000Z)
  // Remove everything except numbers and T
  const cleaned = icalDate.replace(/[^0-9T]/g, '')
  
  if (cleaned.length < 8) {
    throw new Error('Invalid iCal date format')
  }
  
  // Extract date parts
  const year = cleaned.substring(0, 4)
  const month = cleaned.substring(4, 6)
  const day = cleaned.substring(6, 8)
  
  // Extract time parts if they exist
  let hour = '00', minute = '00', second = '00'
  if (cleaned.length >= 15 && cleaned[8] === 'T') {
    hour = cleaned.substring(9, 11)
    minute = cleaned.substring(11, 13)
    second = cleaned.substring(13, 15)
  }
  
  // Check if it's UTC (ends with Z in original)
  const isUTC = icalDate.toUpperCase().endsWith('Z')
  
  // Create Date object
  let date: Date
  if (isUTC) {
    // For UTC times, create using the UTC constructor
    date = new Date(Date.UTC(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second)
    ))
  } else {
    // For local times, create as local date
    date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`)
  }
  
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${icalDate}`)
  }
  
  // If the calendar is in a specific timezone and the time is UTC,
  // we need to convert it to that timezone
  if (isUTC && timezone !== 'UTC') {
    // Get the timezone offset for the given timezone
    // For now, we'll handle common US timezones
    const utcTime = date.getTime()
    let offset = 0
    
    // Simple timezone handling (would be better with a proper timezone library)
    switch (timezone) {
      case 'America/Denver':
        // MST (UTC-7) or MDT (UTC-6) depending on DST
        // For simplicity, we'll use MST (UTC-7)
        offset = -7 * 60 * 60 * 1000
        break
      case 'America/Los_Angeles':
        // PST (UTC-8) or PDT (UTC-7)
        offset = -8 * 60 * 60 * 1000
        break
      case 'America/New_York':
        // EST (UTC-5) or EDT (UTC-4)
        offset = -5 * 60 * 60 * 1000
        break
      case 'America/Chicago':
        // CST (UTC-6) or CDT (UTC-5)
        offset = -6 * 60 * 60 * 1000
        break
    }
    
    if (offset !== 0) {
      date = new Date(utcTime + offset)
    }
  }
  
  // Return ISO string without timezone info
  return date.toISOString().replace('Z', '')
}
