import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildCorsHeaders, handleOptions } from "../_shared/cors.ts";

serve(async (req) => {
  const origin = req.headers.get("origin");
  const methods = "GET, OPTIONS";
  const cors = buildCorsHeaders(origin, methods);
  
  // Handle CORS preflight
  const pre = handleOptions(req, methods);
  if (pre) return pre;
  
  try {
    const url = new URL(req.url);
    const icalUrl = url.searchParams.get('url');
    
    if (!icalUrl) {
      return new Response(JSON.stringify({ error: 'url parameter required' }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" }
      });
    }
    
    // Fetch the iCal file
    const response = await fetch(icalUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch iCal: ${response.status}`);
    }
    
    const icalData = await response.text();
    
    return new Response(icalData, {
      status: 200,
      headers: { 
        ...cors, 
        "Content-Type": "text/calendar",
        "Cache-Control": "public, max-age=300" // Cache for 5 minutes
      }
    });
    
  } catch (error) {
    console.error('iCal proxy error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch iCal file',
      details: error.message 
    }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" }
    });
  }
});
