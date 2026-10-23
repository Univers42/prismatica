/**
 * Request-derived text (User-Agent, IP, origin, referer, geolocation) as it may appear in a
 * security mail. The text is an attacker's: a User-Agent of `<script>alert(1)</script>` is
 * HTML-escaped to `&lt;script&gt;...` and the production WAF (CRS 932235, unix command
 * injection) matches `;script&` in that escape and answers 403 on POST /email/v1/send, so one
 * hostile header suppresses the victim's alert (grobase m227 audit log, 2026-10-17). The mail
 * therefore only ever carries a conservative charset; escaping stays as defence in depth.
 *
 * Caveat: a heuristic. Everything outside ASCII letters, digits, space and `. , : / ( ) _ + -`
 * is dropped, so a non-Latin browser or city name loses its characters (a name that is all
 * non-Latin shows the placeholder), and `;` in a User-Agent becomes a space. Plain-charset
 * text such as `/etc/passwd` survives and is not judged here. The audit log keeps the raw value.
 */
const UNSAFE = /[^A-Za-z0-9 .,:/()_+-]+/g;

export function displaySafe(value, maxLength, placeholder = 'unknown') {
	const shown = String(value ?? '').replaceAll(UNSAFE, ' ').replaceAll(/ {2,}/g, ' ').trim();
	if (!shown) return placeholder;
	return shown.length > maxLength ? `${shown.slice(0, maxLength).trimEnd()}...` : shown;
}

function header(headers, name) {
	const value = headers[name];
	return Array.isArray(value) ? value.join(', ') : value;
}

/** The variables of login-alert.html for one sign-in attempt; `location` is already composed. */
export function loginAlertMailFields({ headers, ipAddress, location, outcome }) {
	return {
		ipAddress: displaySafe(ipAddress, 64),
		location: displaySafe(location, 240),
		outcome: outcome === 'success' ? 'Successful sign-in' : 'Failed sign-in attempt',
		method: outcome === 'success' ? 'Successful password sign-in through the Prismatica auth gateway' : 'Failed password sign-in attempt through the Prismatica auth gateway',
		userAgent: displaySafe(header(headers, 'user-agent'), 160, 'unknown device'),
		origin: displaySafe(header(headers, 'origin'), 240, 'not sent'),
		referer: displaySafe(header(headers, 'referer'), 240, 'not sent'),
		forwardedFor: displaySafe(header(headers, 'x-forwarded-for'), 240, 'not sent'),
	};
}
