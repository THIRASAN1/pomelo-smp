import type { APIRoute } from 'astro';

export const prerender = true;

/**
 * Serve robots.txt dynamically so the absolute sitemap URL tracks `site` in astro.config.
 * Admin + API surfaces are disallowed; everything else is open to crawlers.
 */
export const GET: APIRoute = ({ site }) => {
  const base = (site?.href ?? 'https://pomelosmp.net').replace(/\/+$/, '');
  const body = [
    'User-agent: *',
    'Disallow: /admin',
    'Disallow: /admin/',
    'Disallow: /api/',
    '',
    `Sitemap: ${base}/sitemap.xml`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
};
