// robots.txt from the configured origin (PUBLIC_SITE_URL), so the sitemap line is right on every
// deployment instead of pointing at localhost.
import type { APIRoute } from 'astro';
import { NOINDEX_PREFIXES } from '../data/noindex.mjs';

export const GET: APIRoute = ({ site }) => {
	const lines = ['User-agent: *', 'Allow: /', ...NOINDEX_PREFIXES.map((prefix) => `Disallow: ${prefix}`), ''];
	if (site) lines.push(`Sitemap: ${new URL('sitemap-index.xml', site).href}`);
	return new Response(`${lines.join('\n')}\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
