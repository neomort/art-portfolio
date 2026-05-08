import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildCorsHeaders, handleOptions } from "../_shared/cors.ts";
serve(async (req)=>{
  const origin = req.headers.get("origin");
  const methods = "GET, POST, OPTIONS";
  const cors = buildCorsHeaders(origin, methods);
  // Handle CORS preflight
  const pre = handleOptions(req, methods);
  if (pre) return pre;
  // Get the Supabase client for the function
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.39.7");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabase = createClient(supabaseUrl, supabaseKey);
  // Query all property types and amenities in use
  const { data: properties, error } = await supabase.from("properties").select("property_type, amenities").not("property_type", "is", null).not("amenities", "is", null);
  if (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" }
    });
  }
  // Aggregate unique property types and amenities
  const propertyTypeSet = new Set();
  const amenitySet = new Set();
  for (const prop of properties ?? []){
    if (prop.property_type) {
      propertyTypeSet.add(prop.property_type);
    }
    if (Array.isArray(prop.amenities)) {
      for (const amenity of prop.amenities){
        if (typeof amenity === "string") {
          amenitySet.add(amenity);
        }
      }
    }
  }
  // Format amenities as array of { id, label }
  const amenities = Array.from(amenitySet).map((id)=>({
      id,
      label: id
    }));
  return new Response(JSON.stringify({
    propertyTypes: Array.from(propertyTypeSet),
    amenities
  }), {
    headers: { ...cors, "Content-Type": "application/json" }
  });
});