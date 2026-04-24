import type { APIRoute } from 'astro';

export const prerender = true;

/**
 * Minimal hand-rolled sitemap. The site is essentially a single-page landing
 * so we just list `/` for now — add more routes here if/when they appear.
 * Admin + API routes must never be listed.
 */
const PATHS = ['/'];

export const GET: APIRoute = ({ site }) => {
  const base = (site?.href ?? 'https://pomelosmp.net').replace(/\/+$/, '');
  const lastmod = new Date().toISOString().slice(0, 10);

  const urls = PATHS.map(
    (p) => `  <url>
    <loc>${base}${p}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${p === '/' ? '1.0' : '0.7'}</priority>
  </url>`,
  ).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

  return new Response(xml, {
    headers: { 'content-type': 'application/xml; charset=utf-8' },
  });
};
