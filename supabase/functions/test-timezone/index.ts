// @ts-nocheck: Edge Function with Deno runtime - TypeScript checking disabled for compatibility

function formatICalDate(icalDate: string, timezone?: string): string {
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
  
  // Return ISO string without timezone info
  return date.toISOString().replace('Z', '')
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const testDates = [
      { ical: '20260109T000000Z', desc: 'Midnight UTC' },
      { ical: '20260109T013000Z', desc: '1:30 AM UTC' },
      { ical: '20260110T010000Z', desc: '1 AM UTC next day' },
      { ical: '20260110T040000Z', desc: '4 AM UTC next day' }
    ]
    
    const results = testDates.map(({ ical, desc }) => {
      const iso = formatICalDate(ical)
      const date = new Date(iso)
      return {
        ical,
        desc,
        iso,
        localString: date.toLocaleString(),
        utcString: date.toUTCString(),
        mstOffset: date.getTimezoneOffset()
      }
    })
    
    return new Response(JSON.stringify(results, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
