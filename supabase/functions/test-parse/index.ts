// @ts-nocheck: Edge Function with Deno runtime - TypeScript checking disabled for compatibility

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
    const body = await req.json()
    const icalUrls = body.icalUrls || []
    
    const icalUrl = icalUrls[0]
    const response = await fetch(icalUrl, {
      headers: {
        'User-Agent': 'SplitSpace-Calendar-Sync/1.0',
        'Accept': 'text/calendar,text/plain',
      },
    })
    
    const icalData = await response.text()
    const lines = icalData.split(/\r?\n/)
    
    let inEvent = false
    let eventCount = 0
    const events = []
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      if (line === 'BEGIN:VEVENT') {
        inEvent = true
        continue
      }
      
      if (line === 'END:VEVENT') {
        if (inEvent) {
          eventCount++
          events.push({
            line: i,
            content: lines.slice(Math.max(0, i-10), i+1).join('\n')
          })
        }
        inEvent = false
        continue
      }
    }
    
    return new Response(JSON.stringify({ 
      totalLines: lines.length,
      eventCount: eventCount,
      events: events.slice(0, 3), // First 3 events
      firstLines: lines.slice(0, 20),
      containsBeginEvent: lines.includes('BEGIN:VEVENT'),
      containsEndEvent: lines.includes('END:VEVENT')
    }), {
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
