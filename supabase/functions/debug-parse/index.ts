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

  const logs = []
  
  function log(...args) {
    logs.push(args.join(' '))
  }

  try {
    const body = await req.json()
    const icalUrls = body.icalUrls || []
    
    const icalUrl = icalUrls[0]
    log('Fetching URL:', icalUrl)
    
    const response = await fetch(icalUrl, {
      headers: {
        'User-Agent': 'SplitSpace-Calendar-Sync/1.0',
        'Accept': 'text/calendar,text/plain',
      },
    })
    
    const icalData = await response.text()
    log('Data length:', icalData.length)
    
    const lines = icalData.split(/\r?\n/)
    log('Total lines:', lines.length)
    
    let inEvent = false
    let currentEvent = {}
    let eventCount = 0
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      if (line === 'BEGIN:VEVENT') {
        inEvent = true
        currentEvent = {}
        log('Event start at line', i)
        continue
      }
      
      if (inEvent && line.includes(':')) {
        const [key, value] = line.split(':')
        if (key === 'DTSTART') {
          currentEvent.dtstart = value
          log('Found DTSTART:', value)
        } else if (key === 'DTEND') {
          currentEvent.dtend = value
          log('Found DTEND:', value)
        } else if (key === 'SUMMARY') {
          currentEvent.summary = value
          log('Found SUMMARY:', value)
        }
      }
      
      if (line === 'END:VEVENT') {
        log('Event end at line', i, 'has dtstart:', !!currentEvent.dtstart, 'has dtend:', !!currentEvent.dtend)
        if (inEvent && currentEvent.dtstart && currentEvent.dtend) {
          eventCount++
          log('Event complete:', currentEvent.summary)
        }
        inEvent = false
        currentEvent = {}
      }
    }
    
    log('Total events found:', eventCount)
    
    return new Response(JSON.stringify({ 
      logs: logs,
      eventCount: eventCount
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })
    
  } catch (error) {
    log('Error:', error.message)
    return new Response(JSON.stringify({ 
      logs: logs,
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
