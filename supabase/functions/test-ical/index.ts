// @ts-nocheck: Edge Function with Deno runtime - TypeScript checking disabled for compatibility

Deno.serve(async (req) => {
  console.log('=== Test Edge Function Started ===')
  console.log('Method:', req.method)
  console.log('Headers:', Object.fromEntries(req.headers.entries()))
  
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
    console.log('Received body:', body)
    
    const icalUrls = body.icalUrls || []
    console.log('iCal URLs:', icalUrls)
    
    if (icalUrls.length === 0) {
      return new Response(JSON.stringify({ error: 'No URLs provided' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    // Just fetch and return the raw data for debugging
    const icalUrl = icalUrls[0]
    console.log('Fetching URL:', icalUrl)
    
    const response = await fetch(icalUrl, {
      headers: {
        'User-Agent': 'SplitSpace-Calendar-Sync/1.0',
        'Accept': 'text/calendar,text/plain',
      },
    })
    
    console.log('Response status:', response.status)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.text()
    console.log('Data length:', data.length)
    console.log('First 500 chars:', data.substring(0, 500))
    
    return new Response(JSON.stringify({ 
      url: icalUrl,
      status: response.status,
      dataLength: data.length,
      firstChunk: data.substring(0, 1000),
      containsEvents: data.includes('BEGIN:VEVENT')
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })
    
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
