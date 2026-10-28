// The osionos bridge answers with a redirect URL; the browser follows it only to a known app origin.
export function isTrustedOsionosRedirect(redirectUrl: string): boolean {
	try {
		const parsed = new URL(redirectUrl, window.location.origin);
		const allowed = [
			window.location.origin,
			import.meta.env.PUBLIC_OSIONOS_APP_URL,
			'https://app.osionos.com',
			'http://localhost:3000',
			'http://localhost:4321',
			'http://localhost:4322',
		].filter(Boolean);
		return allowed.some((origin) => {
			try {
				return new URL(origin).origin === parsed.origin;
			} catch {
				return false;
			}
		});
	} catch {
		return false;
	}
}
