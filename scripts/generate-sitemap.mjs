import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const RESERVED_STATIC_SLUGS = new Set([
  'admin',
  'dashboard',
  'favorites',
  'forgot-password',
  'home',
  'inquiry-debug',
  'list-property',
  'messages',
  'page',
  'payment',
  'payment-debug',
  'profile',
  'properties',
  'property',
  'reset-password',
  'signin',
  'signup',
  'stripe-test',
  'webhook-debug',
]);

const STATIC_ROUTES = [
  { path: '/', changefreq: 'daily', priority: 1.0 },
  { path: '/properties', changefreq: 'daily', priority: 0.9 },
  { path: '/vendor', changefreq: 'monthly', priority: 0.6 },
  { path: '/venue', changefreq: 'monthly', priority: 0.6 },
  { path: '/news-info', changefreq: 'weekly', priority: 0.7 },
  { path: '/faq', changefreq: 'monthly', priority: 0.6 },
  { path: '/getstarted', changefreq: 'monthly', priority: 0.6 },
  { path: '/signup', changefreq: 'yearly', priority: 0.4 },
];

const baseUrl = (() => {
  const raw = process.env.VITE_FRONTEND_URL || '';
  if (!raw) return null;
  try {
    const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    return url.origin.replace(/\/$/, '');
  } catch (error) {
    console.warn(`[sitemap] Invalid base URL "${raw}". Falling back to placeholder.`);
    return null;
  }
})();

const sitemapBase = baseUrl ?? 'https://example.com';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    })
  : null;

function buildUrl(path) {
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  return `${sitemapBase}${path}`;
}

function formatLastMod(value) {
  if (!value) return new Date().toISOString();
  try {
    return new Date(value).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

async function loadPublishedProperties() {
  if (!supabase) {
    console.warn('[sitemap] Supabase credentials missing. Skipping property URLs.');
    return [];
  }

  const { data, error } = await supabase
    .from('properties')
    .select('id, updated_at, published')
    .eq('published', true)
    .order('updated_at', { ascending: false });

  if (error) {
    console.warn('[sitemap] Failed to load properties:', error.message);
    return [];
  }

  return (data ?? [])
    .filter((row) => row?.id)
    .map((row) => ({
      path: `/property/${row.id}`,
      lastmod: row.updated_at,
      changefreq: 'weekly',
      priority: 0.8,
    }));
}

async function loadPublishedPages() {
  if (!supabase) {
    console.warn('[sitemap] Supabase credentials missing. Skipping CMS page URLs.');
    return [];
  }

  const { data, error } = await supabase
    .from('pages')
    .select('slug, updated_at');

  if (error) {
    console.warn('[sitemap] Failed to load CMS pages:', error.message);
    return [];
  }

  return (data ?? [])
    .filter((row) => typeof row?.slug === 'string' && row.slug.trim() !== '')
    .filter((row) => !RESERVED_STATIC_SLUGS.has(row.slug))
    .map((row) => ({
      path: `/${row.slug}`,
      lastmod: row.updated_at,
      changefreq: 'monthly',
      priority: 0.6,
    }));
}

function dedupeUrls(entries) {
  const seen = new Map();
  for (const entry of entries) {
    if (!entry || !entry.path) continue;
    const key = entry.path;
    if (!seen.has(key)) {
      seen.set(key, entry);
    } else {
      const existing = seen.get(key);
      if (!existing.lastmod && entry.lastmod) {
        seen.set(key, entry);
      }
    }
  }
  return Array.from(seen.values());
}

async function buildSitemap() {
  const [properties, pages] = await Promise.all([
    loadPublishedProperties(),
    loadPublishedPages(),
  ]);

  const entries = dedupeUrls([
    ...STATIC_ROUTES,
    ...properties,
    ...pages,
  ]);

  const urls = entries.map((entry) => {
    const loc = buildUrl(entry.path);
    const lastmod = formatLastMod(entry.lastmod);
    const changefreq = entry.changefreq || 'monthly';
    const priority = typeof entry.priority === 'number' ? entry.priority.toFixed(1) : '0.5';

    return `    <url>\n      <loc>${loc}</loc>\n      <lastmod>${lastmod}</lastmod>\n      <changefreq>${changefreq}</changefreq>\n      <priority>${priority}</priority>\n    </url>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${urls.join('\n')}\n` +
    `</urlset>\n`;

  const outputPath = resolve(process.cwd(), 'public', 'sitemap.xml');
  await writeFile(outputPath, xml, 'utf8');
  console.log(`[sitemap] Wrote ${entries.length} URLs to ${outputPath}`);
}

try {
  await buildSitemap();
} catch (error) {
  console.error('[sitemap] Failed to generate sitemap:', error);
  process.exitCode = 1;
}
