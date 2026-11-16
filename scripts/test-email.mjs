export function testEmailDomain(fallback = 'mini-baas.local') {
	const explicit = process.env.AUTH_TEST_EMAIL_DOMAIN || process.env.TEST_EMAIL_DOMAIN;
	if (explicit) return explicit.trim().toLowerCase();

	return fallback;
}

export function uniqueTestEmail(label, envName) {
	const configured = envName ? process.env[envName] : '';
	if (configured) return configured.trim().toLowerCase();

	const timestamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
	const safeLabel = String(label || 'test').toLowerCase().replaceAll(/[^a-z0-9_-]/g, '-');
	return `devfast+${safeLabel}-${timestamp}@${testEmailDomain()}`;
}
