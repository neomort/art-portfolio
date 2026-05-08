// @ts-nocheck: Edge Function with Deno runtime - TypeScript checking disabled for compatibility

function formatICalDate(icalDate: string): string {
  // Handle both basic format (20251225T100000) and UTC format (20251225T100000Z)
  const cleaned = icalDate.replace(/[^0-9T]/g, '')
  
  if (cleaned.length < 8) {
    throw new Error('Invalid iCal date format')
  }
  
  // Extract date parts
  const year = cleaned.substring(0, 4)
  const month = cleaned.substring(4, 6)
  const day = cleaned.substring(6, 8)
  const hour = cleaned.substring(8, 10) || '00'
  const minute = cleaned.substring(10, 12) || '00'
  const second = cleaned.substring(12, 14) || '00'
  
  // Check if it's UTC (ends with Z in original)
  const isUTC = icalDate.toUpperCase().endsWith('Z')
  
  // Create ISO string
  let isoString = `${year}-${month}-${day}T${hour}:${minute}:${second}`
  if (isUTC) {
    isoString += 'Z'
  } else {
    // For local times, we'll assume they're in the property's timezone
    // For now, just return as-is without timezone info
  }
  
  return isoString
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
      '20260109T000000Z',
      '20260109T013000Z',
      '20260110T010000Z',
      '20260110T040000Z'
    ]
    
    const results = testDates.map(date => {
      try {
        const iso = formatICalDate(date)
        const jsDate = new Date(iso)
        return {
          original: date,
          iso: iso,
          valid: !isNaN(jsDate.getTime()),
          dateObj: jsDate.toISOString()
        }
      } catch (e) {
        return {
          original: date,
          error: e.message
        }
      }
    })
    
    return new Response(JSON.stringify(results), {
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
