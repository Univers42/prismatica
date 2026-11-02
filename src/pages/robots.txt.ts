import type { APIRoute } from 'astro';

/** Build-time robots.txt so Sitemap tracks PUBLIC_SITE_URL / astro `site` (not a hardcoded localhost). */
export const prerender = true;

export const GET: APIRoute = ({ site }) => {
	const origin = (site ?? new URL('https://localhost:4322')).origin.replace(/\/$/, '');
	const body = [
		'User-agent: *',
		'Allow: /',
		'# Transactional flows — keep out of the index (pages also send noindex).',
		'Disallow: /auth/',
		'Disallow: /newsletter/',
		'',
		`Sitemap: ${origin}/sitemap-index.xml`,
		'',
	].join('\n');

	return new Response(body, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
		},
	});
};
