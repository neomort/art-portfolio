// Supabase Edge Function (Deno)
// Name: fetch_ical
// POST body: { url: string }
// Response: { events: { start: string; end: string; summary?: string; uid?: string }[] }

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function parseICS(ics: string) {
  const lines = ics.replace(/\r/g, "").split("\n");
  const unfold: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i > 0 && (line.startsWith(" ") || line.startsWith("\t"))) {
      unfold[unfold.length - 1] += line.slice(1);
    } else {
      unfold.push(line);
    }
  }
  const events: { [k: string]: string }[] = [];
  let current: { [k: string]: string } | null = null;
  for (const l of unfold) {
    if (l.startsWith("BEGIN:VEVENT")) current = {};
    else if (l.startsWith("END:VEVENT") && current) { events.push(current); current = null; }
    else if (current) {
      const idx = l.indexOf(":");
      if (idx > 0) {
        const key = l.slice(0, idx);
        const val = l.slice(idx + 1);
        current[key] = val;
      }
    }
  }
  function toISO(val?: string) {
    if (!val) return null;
    // Handles forms like: DTSTART:20250910T150000Z or DTSTART;TZID=America/Denver:20250910T090000
    const m = val.match(/^(?:[^:]*:)?(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/);
    if (!m) return null;
    const [_, y, mo, d, hh, mm, ss] = m;
    if (hh && mm && ss) {
      // Treat as UTC if original had Z, otherwise interpret as local then convert to ISO
      const hasZ = /Z$/.test(val);
      if (hasZ) {
        const dt = new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mm, +ss));
        return dt.toISOString();
      } else {
        const dt = new Date(+y, +mo - 1, +d, +hh, +mm, +ss);
        return dt.toISOString();
      }
    } else {
      // All-day: interpret as 00:00 local
      const dt = new Date(+y, +mo - 1, +d, 0, 0, 0);
      return dt.toISOString();
    }
  }
  const out: { start: string; end: string; summary?: string; uid?: string }[] = [];
  for (const ev of events) {
    // Find DTSTART/DTEND allowing params
    const dtstartKey = Object.keys(ev).find(k => k.startsWith("DTSTART"));
    const dtendKey = Object.keys(ev).find(k => k.startsWith("DTEND"));
    const start = toISO(dtstartKey ? ev[dtstartKey] : undefined);
    const end = toISO(dtendKey ? ev[dtendKey] : undefined);
    if (start && end) {
      out.push({
        start,
        end,
        summary: ev["SUMMARY"],
        uid: ev["UID"],
      });
    }
  }
  return out;
}

Deno.serve({ permissions: { net: ["*"] } }, async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "content-type": "application/json" } });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const url = body?.url as string | undefined;
    if (!url) {
      return new Response(JSON.stringify({ error: "Missing url" }), { status: 400, headers: { ...corsHeaders, "content-type": "application/json" } });
    }
    const res = await fetch(url, { headers: { "accept": "text/calendar, */*", "user-agent": "SplitSpace-ICAL-Fetch/1.0 (+https://splitspace.com)" } });
    if (!res.ok) {
      let snippet = "";
      try {
        const text = await res.text();
        snippet = text.slice(0, 300);
      } catch (_) {}
      return new Response(
        JSON.stringify({ error: `Upstream responded ${res.status}`, snippet }),
        { status: 502, headers: { ...corsHeaders, "content-type": "application/json" } }
      );
    }
    const ics = await res.text();
    const events = parseICS(ics);
    return new Response(JSON.stringify({ events }), { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } });
  }
});
